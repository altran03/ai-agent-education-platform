"""
Chain of Thought (CoT) Prompting Service
Provides structured reasoning prompts to enhance persona responses
"""

from typing import Dict, Any, List
import json

class ChainOfThoughtService:
    """
    Service for generating Chain of Thought prompts that encourage
    step-by-step reasoning in persona responses
    """
    
    def __init__(self):
        self.reasoning_templates = {
            "business_decision": {
                "steps": [
                    "Analyze the current situation and context",
                    "Identify key stakeholders and their interests", 
                    "Consider available options and their implications",
                    "Evaluate risks and opportunities",
                    "Make a decision based on your role and goals",
                    "Explain your reasoning clearly"
                ],
                "template": "Let me think through this step by step:\n{steps}\n\nBased on this analysis, here's my response:"
            },
            "problem_solving": {
                "steps": [
                    "Define the problem clearly",
                    "Gather relevant information and context",
                    "Identify potential solutions",
                    "Evaluate pros and cons of each option",
                    "Consider implementation challenges",
                    "Recommend the best approach"
                ],
                "template": "I need to approach this systematically:\n{steps}\n\nHere's my analysis and recommendation:"
            },
            "stakeholder_interaction": {
                "steps": [
                    "Understand the stakeholder's perspective and needs",
                    "Consider your relationship and communication style",
                    "Identify common ground and potential conflicts",
                    "Plan your approach and key messages",
                    "Anticipate their reactions and responses",
                    "Execute your communication strategy"
                ],
                "template": "Let me consider how to best approach this interaction:\n{steps}\n\nHere's how I would respond:"
            },
            "strategic_thinking": {
                "steps": [
                    "Assess the broader business context",
                    "Identify long-term implications and trends",
                    "Consider competitive landscape and market forces",
                    "Evaluate strategic options and trade-offs",
                    "Align with organizational goals and values",
                    "Develop a strategic recommendation"
                ],
                "template": "This requires strategic thinking. Let me break it down:\n{steps}\n\nMy strategic perspective is:"
            }
        }
    
    def get_cot_prompt(self, persona_data: Dict[str, Any], scenario_context: str = "") -> str:
        """
        Generate a Chain of Thought prompt tailored to the persona's role and context
        
        Args:
            persona_data: Dictionary containing persona information
            scenario_context: Additional context about the current scenario
            
        Returns:
            Formatted CoT prompt string
        """
        role = persona_data.get('role', '').lower()
        personality_traits = persona_data.get('personality_traits', {})
        
        # Select appropriate reasoning template based on role
        template_key = self._select_template_for_role(role)
        template = self.reasoning_templates[template_key]
        
        # Customize steps based on persona traits
        customized_steps = self._customize_steps_for_persona(template['steps'], personality_traits, role)
        
        # Format the reasoning steps
        formatted_steps = self._format_reasoning_steps(customized_steps)
        
        # Generate the full CoT prompt
        cot_prompt = template['template'].format(steps=formatted_steps)
        
        # Add role-specific guidance
        role_guidance = self._get_role_specific_guidance(role)
        
        return f"""
{cot_prompt}

{role_guidance}

Remember to:
- Think through each step carefully before responding
- Show your reasoning process clearly
- Consider multiple perspectives and options
- Align your response with your role and personality traits
- Provide specific, actionable insights
"""
    
    def _select_template_for_role(self, role: str) -> str:
        """Select the most appropriate reasoning template for the persona's role"""
        role_mapping = {
            'ceo': 'strategic_thinking',
            'chief executive officer': 'strategic_thinking',
            'manager': 'business_decision',
            'operations manager': 'business_decision',
            'marketing': 'stakeholder_interaction',
            'marketing manager': 'stakeholder_interaction',
            'sales': 'stakeholder_interaction',
            'sales manager': 'stakeholder_interaction',
            'finance': 'business_decision',
            'financial': 'business_decision',
            'analyst': 'problem_solving',
            'business analyst': 'problem_solving',
            'consultant': 'strategic_thinking',
            'advisor': 'strategic_thinking'
        }
        
        # Check for exact matches first
        if role in role_mapping:
            return role_mapping[role]
        
        # Check for partial matches
        for key, template in role_mapping.items():
            if key in role or role in key:
                return template
        
        # Default to business decision making
        return 'business_decision'
    
    def _customize_steps_for_persona(self, steps: List[str], personality_traits: Dict[str, Any], role: str) -> List[str]:
        """Customize reasoning steps based on persona's personality traits"""
        customized_steps = []
        
        for step in steps:
            # Add personality-specific considerations
            if 'analytical' in personality_traits and personality_traits['analytical'] > 7:
                step += " (with detailed data analysis)"
            
            if 'creative' in personality_traits and personality_traits['creative'] > 7:
                step += " (considering innovative approaches)"
            
            if 'assertive' in personality_traits and personality_traits['assertive'] > 7:
                step += " (taking a decisive stance)"
            
            if 'collaborative' in personality_traits and personality_traits['collaborative'] > 7:
                step += " (considering team input and consensus)"
            
            if 'risk_taking' in personality_traits and personality_traits['risk_taking'] > 7:
                step += " (evaluating bold options)"
            
            customized_steps.append(step)
        
        return customized_steps
    
    def _format_reasoning_steps(self, steps: List[str]) -> str:
        """Format the reasoning steps as a numbered list"""
        formatted_steps = []
        for i, step in enumerate(steps, 1):
            formatted_steps.append(f"{i}. {step}")
        return "\n".join(formatted_steps)
    
    def _get_role_specific_guidance(self, role: str) -> str:
        """Get role-specific guidance for Chain of Thought reasoning"""
        guidance_map = {
            'ceo': "As CEO, focus on strategic vision, stakeholder value, and long-term sustainability. Consider how decisions impact the entire organization.",
            'manager': "As a manager, balance team needs with business objectives. Consider delegation, resource allocation, and team development.",
            'marketing': "As a marketing professional, focus on customer needs, brand positioning, and market opportunities. Consider competitive advantages.",
            'sales': "As a sales professional, focus on customer relationships, value proposition, and closing strategies. Consider objections and solutions.",
            'finance': "As a finance professional, focus on financial implications, risk assessment, and ROI. Consider cash flow and profitability.",
            'analyst': "As an analyst, focus on data-driven insights, trend analysis, and evidence-based recommendations. Consider methodology and accuracy.",
            'consultant': "As a consultant, focus on best practices, industry expertise, and client value. Consider implementation feasibility.",
            'advisor': "As an advisor, focus on guidance, expertise, and client success. Consider long-term relationships and trust building."
        }
        
        # Check for exact matches
        if role in guidance_map:
            return guidance_map[role]
        
        # Check for partial matches
        for key, guidance in guidance_map.items():
            if key in role or role in key:
                return guidance
        
        # Default guidance
        return "Consider your professional expertise, industry knowledge, and the specific context of this situation."
    
    def get_adaptive_cot_prompt(self, persona_data: Dict[str, Any], attempt_number: int, scenario_context: str = "") -> str:
        """
        Generate adaptive Chain of Thought prompts that become more detailed
        based on the user's attempt number
        
        Args:
            persona_data: Dictionary containing persona information
            attempt_number: Current attempt number (1, 2, 3, etc.)
            scenario_context: Additional context about the current scenario
            
        Returns:
            Adaptive CoT prompt string
        """
        base_prompt = self.get_cot_prompt(persona_data, scenario_context)
        
        # Add more detailed guidance for subsequent attempts
        if attempt_number > 1:
            additional_guidance = self._get_attempt_specific_guidance(attempt_number)
            base_prompt += f"\n\n{additional_guidance}"
        
        return base_prompt
    
    def _get_attempt_specific_guidance(self, attempt_number: int) -> str:
        """Get additional guidance based on attempt number"""
        if attempt_number == 2:
            return """
Since this is your second attempt, please:
- Reflect on what might have been missed in your previous response
- Consider alternative approaches or perspectives
- Provide more specific details and examples
- Think about potential objections or counterarguments
"""
        elif attempt_number >= 3:
            return """
Since this is attempt #{}, please:
- Take a step back and reconsider the fundamental approach
- Consider if there are underlying assumptions that need to be challenged
- Think about what a completely different perspective might offer
- Provide concrete, actionable steps rather than general advice
""".format(attempt_number)
        
        return ""

# Create global instance
chain_of_thought_service = ChainOfThoughtService()
