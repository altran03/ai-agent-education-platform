# AI Agent Education Platform - Main FastAPI Application
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import List, Optional
import uvicorn
from datetime import datetime, timedelta
from pathlib import Path

from database.connection import get_db, engine, settings
from database.models import Base, User, Scenario, ScenarioPersona, ScenarioScene, ScenarioFile, ScenarioReview, scene_personas
from database.schemas import (
    ScenarioCreate, UserRegister, UserLogin, UserLoginResponse, 
    UserResponse, UserUpdate, PasswordChange
)
from utilities.auth import (
    get_password_hash, authenticate_user, create_access_token, 
    get_current_user, get_current_user_optional, require_admin
)

# Import API routers
from api.parse_pdf import router as pdf_router
from api.simulation import router as simulation_router
from api.publishing import router as publishing_router
from api.oauth import router as oauth_router, lifespan as oauth_lifespan

# Import startup check
from startup_check import run_startup_checks, auto_setup_if_needed

# Import session manager for cleanup task
from services.session_manager import session_manager

# Create FastAPI app
app = FastAPI(
    title="AI Agent Education Platform",
    description="Transform business case studies into immersive AI-powered educational simulations",
    version="2.0.0",
    lifespan=oauth_lifespan
)

@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring and load balancers"""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

@app.on_event("startup")
async def startup_event():
    """Run startup checks when the application starts"""
    import logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)
    
    logger.info("🚀 Starting AI Agent Education Platform...")
    
    # Try auto-setup first (only in development)
    if not auto_setup_if_needed():
        logger.warning("⚠️  Auto-setup failed, continuing with manual checks...")
    
    # Run startup checks
    if not run_startup_checks():
        logger.error("❌ Startup checks failed - the application may not work correctly")
        logger.error("Please run: python backend/setup_dev_environment.py")
    else:
        logger.info("✅ Application startup completed successfully!")
    
    # Start the session cleanup task
    try:
        session_manager.start_cleanup_task()
        logger.info("🧹 Session cleanup task started successfully")
    except Exception as e:
        logger.error(f"❌ Failed to start session cleanup task: {e}")
        # Don't fail startup for this, but log the error

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(pdf_router, tags=["PDF Processing"])
app.include_router(simulation_router, tags=["Simulation"])
app.include_router(publishing_router, tags=["Publishing"])
app.include_router(oauth_router, tags=["OAuth"])

# Create database tables (development only)
if settings.environment != "production":
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created (development mode)")
else:
    print("⚠️  Skipping create_all in production - use Alembic migrations")

# Mount static files for serving images
static_dir = Path("static")
static_dir.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "AI Simulation Marketplace Platform API",
        "version": "2.0.0",
        "status": "active"
    }


@app.get("/api/scenarios/")
async def get_scenarios(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get scenarios created by the current user with their personas and scenes"""
    try:
        scenarios = db.query(Scenario).filter(
            Scenario.created_by == current_user.id
        ).order_by(Scenario.created_at.desc()).all()
        
        result = []
        for scenario in scenarios:
            # Get personas for this scenario
            personas = db.query(ScenarioPersona).filter(
                ScenarioPersona.scenario_id == scenario.id
            ).all()
            
            # Get scenes for this scenario
            scenes = db.query(ScenarioScene).filter(
                ScenarioScene.scenario_id == scenario.id
            ).order_by(ScenarioScene.scene_order).all()
            
            scenario_data = {
                "id": scenario.id,
                "title": scenario.title,
                "description": scenario.description,
                "challenge": scenario.challenge,
                "industry": scenario.industry,
                "learning_objectives": scenario.learning_objectives or [],
                "student_role": scenario.student_role,
                "created_at": scenario.created_at.isoformat() if scenario.created_at else None,
                "is_public": scenario.is_public,
                "personas": [
                    {
                        "id": persona.id,
                        "name": persona.name,
                        "role": persona.role,
                        "background": persona.background,
                        "correlation": persona.correlation,
                        "primary_goals": persona.primary_goals or [],
                        "personality_traits": persona.personality_traits or {}
                    }
                    for persona in personas
                ],
                "scenes": [
                    {
                        "id": scene.id,
                        "title": scene.title,
                        "description": scene.description,
                        "user_goal": scene.user_goal,
                        "scene_order": scene.scene_order,
                        "estimated_duration": scene.estimated_duration,
                        "image_url": scene.image_url
                    }
                    for scene in scenes
                ]
            }
            result.append(scenario_data)
        
        return result
        
    except Exception as e:
        print(f"[ERROR] Failed to fetch scenarios: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch scenarios: {str(e)}")

# --- USER AUTHENTICATION & MANAGEMENT ---
@app.post("/users/register", response_model=UserResponse)
async def register_user(user: UserRegister, db: Session = Depends(get_db)):
    """Register a new user"""
    # Check if user already exists
    existing_user = db.query(User).filter(
        (User.email == user.email) | (User.username == user.username)
    ).first()
    
    if existing_user:
        if existing_user.email == user.email:
            raise HTTPException(status_code=400, detail="Email already registered")
        else:
            raise HTTPException(status_code=400, detail="Username already taken")
    
    # Create new user
    hashed_password = get_password_hash(user.password)
    db_user = User(
        email=user.email,
        full_name=user.full_name,
        username=user.username,
        password_hash=hashed_password,
        bio=user.bio,
        avatar_url=user.avatar_url,
        profile_public=user.profile_public,
        allow_contact=user.allow_contact
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user

@app.post("/users/login", response_model=UserLoginResponse)
async def login_user(user: UserLogin, db: Session = Depends(get_db)):
    """Login user and return access token"""
    db_user = authenticate_user(db, user.email, user.password)
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": str(db_user.id)})
    
    return UserLoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=db_user.id,
            email=db_user.email,
            full_name=db_user.full_name,
            username=db_user.username,
            bio=db_user.bio,
            avatar_url=db_user.avatar_url,
            role=db_user.role,
            published_scenarios=db_user.published_scenarios,
            total_simulations=db_user.total_simulations,
            reputation_score=db_user.reputation_score,
            profile_public=db_user.profile_public,
            allow_contact=db_user.allow_contact,
            is_active=db_user.is_active,
            is_verified=db_user.is_verified,
            created_at=db_user.created_at,
            updated_at=db_user.updated_at
        )
    )

@app.get("/users/me", response_model=UserResponse)
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Get current user profile"""
    return current_user

@app.post("/test-login")
async def test_login(user: UserLogin, db: Session = Depends(get_db)):
    """Test endpoint to debug login issues (development only)"""
    # Only allow in development environment
    if settings.environment == "production":
        raise HTTPException(
            status_code=404,
            detail="Not found"
        )
    
    try:
        db_user = authenticate_user(db, user.email, user.password)
        if not db_user:
            # Always return generic error to prevent user enumeration
            return {"error": "Authentication failed", "status": "error"}
        
        return {"success": True, "user": {"id": "redacted"}}
    except Exception as e:
        # Log the actual error server-side but return generic error to client
        print(f"[ERROR] Test login failed: {str(e)}")
        return {"error": "Authentication failed", "status": "error"}

@app.put("/users/me", response_model=UserResponse)
async def update_current_user(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user profile"""
    # Update fields
    for field, value in user_update.dict(exclude_unset=True).items():
        setattr(current_user, field, value)
    
    current_user.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(current_user)
    
    return current_user

@app.post("/users/change-password")
async def change_password(
    password_change: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change user password"""
    # Verify current password
    if not authenticate_user(db, current_user.email, password_change.current_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Update password
    current_user.password_hash = get_password_hash(password_change.new_password)
    current_user.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {"message": "Password changed successfully"}

@app.get("/users/{user_id}", response_model=UserResponse)
async def get_user_profile(user_id: int, db: Session = Depends(get_db)):
    """Get user profile (public information only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Only return public profiles
    if not user.profile_public:
        raise HTTPException(status_code=404, detail="Profile is private")
    
    return user

# --- BASIC SCENARIO ENDPOINTS ---
@app.get("/scenarios", response_model=List[dict])
async def get_public_scenarios(
    skip: int = 0, 
    limit: int = 20, 
    db: Session = Depends(get_db)
):
    """Get public scenarios for marketplace"""
    scenarios = db.query(Scenario).filter(
        Scenario.is_public == True
    ).offset(skip).limit(limit).all()
    
    return [
        {
            "id": scenario.id,
            "title": scenario.title,
            "description": scenario.description,
            "category": scenario.category,
            "difficulty_level": scenario.difficulty_level,
            "estimated_duration": scenario.estimated_duration,
            "rating_avg": scenario.rating_avg,
            "rating_count": scenario.rating_count,
            "usage_count": scenario.usage_count
        }
        for scenario in scenarios
    ]

@app.get("/scenarios/{scenario_id}")
async def get_scenario_details(scenario_id: int, db: Session = Depends(get_db)):
    """Get detailed scenario information"""
    scenario = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    # Count personas and scenes
    persona_count = db.query(ScenarioPersona).filter(ScenarioPersona.scenario_id == scenario_id).count()
    scene_count = db.query(ScenarioScene).filter(ScenarioScene.scenario_id == scenario_id).count()
    
    return {
        "id": scenario.id,
        "title": scenario.title,
        "description": scenario.description,
        "challenge": scenario.challenge,
        "industry": scenario.industry,
        "learning_objectives": scenario.learning_objectives,
        "student_role": scenario.student_role,
        "category": scenario.category,
        "difficulty_level": scenario.difficulty_level,
        "estimated_duration": scenario.estimated_duration,
        "tags": scenario.tags,
        "rating_avg": scenario.rating_avg,
        "rating_count": scenario.rating_count,
        "usage_count": scenario.usage_count,
        "persona_count": persona_count,
        "scene_count": scene_count,
        "is_public": scenario.is_public,
        "created_at": scenario.created_at
    }

@app.get("/api/test")
async def test_endpoint():
    """Test endpoint to verify server is working"""
    return {"status": "ok", "message": "Server is working"}

@app.get("/api/test-auth")
async def test_auth_endpoint(current_user: User = Depends(get_current_user)):
    """Test endpoint with authentication"""
    return {"status": "ok", "user": current_user.email}

@app.get("/api/test-db")
async def test_db_endpoint(db: Session = Depends(get_db)):
    """Test endpoint with database"""
    try:
        count = db.query(Scenario).count()
        return {"status": "ok", "scenario_count": count}
    except Exception as e:
        return {"status": "error", "error": str(e)}

@app.get("/api/test-combined")
async def test_combined_endpoint(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Test endpoint with both database and authentication"""
    try:
        count = db.query(Scenario).count()
        return {"status": "ok", "scenario_count": count, "user": current_user.email}
    except Exception as e:
        return {"status": "error", "error": str(e)}

@app.get("/api/scenario-test/{scenario_id}")
async def test_scenario_endpoint(scenario_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Test endpoint with scenario_id parameter"""
    try:
        scenario = db.query(Scenario).filter(Scenario.id == scenario_id).first()
        if not scenario:
            return {"status": "error", "error": "Scenario not found"}
        return {"status": "ok", "scenario_id": scenario_id, "title": scenario.title, "user": current_user.email}
    except Exception as e:
        return {"status": "error", "error": str(e)}

@app.get("/api/scenarios/{scenario_id}/full")
async def get_scenario_full(scenario_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get full scenario with personas and scenes including scene-persona relationships"""
    try:
        print(f"[DEBUG] Starting get_scenario_full for scenario_id: {scenario_id}")
        print(f"[DEBUG] Database session: {db}")
        print(f"[DEBUG] Current user: {current_user.email}")
        return {"status": "ok", "scenario_id": scenario_id, "user": current_user.email}
    except Exception as e:
        print(f"[ERROR] get_scenario_full failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 