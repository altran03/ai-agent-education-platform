"use client"


import React, { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Progress } from "@/components/ui/progress"
import { Upload, Info, Users, Activity, Sparkles, X } from "lucide-react"
import Link from "next/link"
import PersonaCard from "@/components/PersonaCard";


// Simple Modal component
function Modal({ isOpen, onClose, children }: { isOpen: boolean; onClose: () => void; children: React.ReactNode }) {
 React.useEffect(() => {
   if (isOpen) {
     document.body.classList.add('overflow-hidden');
   } else {
     document.body.classList.remove('overflow-hidden');
   }
   return () => {
     document.body.classList.remove('overflow-hidden');
   };
 }, [isOpen]);
 if (!isOpen) return null;
 return (
   <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-60">
     <div className="bg-white rounded-lg shadow-lg max-w-[900px] min-w-[600px] max-h-[90vh] overflow-y-auto flex flex-col relative p-0">
       <button
         className="absolute top-4 right-4 text-gray-400 text-2xl font-bold hover:text-gray-600 z-10"
         onClick={onClose}
         aria-label="Close edit window"
       >
         &times;
       </button>
       {children}
     </div>
   </div>
 );
}


export default function ScenarioBuilder() {
 const [uploadedFile, setUploadedFile] = useState<File | null>(null)
 const fileInputRef = useRef<HTMLInputElement>(null)
 const [name, setName] = useState("")
 const [description, setDescription] = useState("")
 const [learningOutcomes, setLearningOutcomes] = useState("")
 const [autofillLoading, setAutofillLoading] = useState(false)
 const [autofillError, setAutofillError] = useState<string | null>(null)
 const [autofillResult, setAutofillResult] = useState<any>(null)
 const [autofillStep, setAutofillStep] = useState<string>("")
 const [autofillProgress, setAutofillProgress] = useState(0)
 const [autofillMaxAttempts, setAutofillMaxAttempts] = useState(60)
 const [isDragOver, setIsDragOver] = useState(false)
 const [uploadedFiles, setUploadedFiles] = useState<File[]>([]); // For the "Upload Files" button
 const filesInputRef = useRef<HTMLInputElement>(null);
 const [personas, setPersonas] = useState<any[]>([]);
 const [editingIdx, setEditingIdx] = useState<number | null>(null);


 // Placeholder handlers for personas and timeline
 const handleAddPersona = () => {
   const newPersona = {
     name: "New Persona",
     position: "",
     description: "",
     traits: {
       assertiveness: 3,
       cooperativeness: 3,
       openness: 3,
       risk_tolerance: 3,
       emotional_stability: 3
     },
     defaultTraits: {
       assertiveness: 3,
       cooperativeness: 3,
       openness: 3,
       risk_tolerance: 3,
       emotional_stability: 3
     },
     primaryGoals: ""
   };
   setPersonas(personas => [...personas, newPersona]);
   setEditingIdx(personas.length); // Open the new persona for editing
 }
 const handleAddScene = () => {}


 // Handler to clear the uploaded file and open the file picker
 const handleChooseDifferentFile = (e: React.MouseEvent) => {
   e.preventDefault();
   setUploadedFile(null);
   if (fileInputRef.current) fileInputRef.current.value = "";
 }


 const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
   const file = e.target.files?.[0]
   if (file) setUploadedFile(file)
 }


 const handleDragOver = (e: React.DragEvent) => {
   e.preventDefault()
   setIsDragOver(true)
 }


 const handleDragLeave = (e: React.DragEvent) => {
   e.preventDefault()
   setIsDragOver(false)
 }


 const handleDrop = (e: React.DragEvent) => {
   e.preventDefault()
   setIsDragOver(false)
  
   const files = Array.from(e.dataTransfer.files)
   const pdfFile = files.find(file => file.type === "application/pdf")
  
   if (pdfFile) {
     setUploadedFile(pdfFile)
     // Clear the file input value to ensure it updates
     if (fileInputRef.current) {
       fileInputRef.current.value = ""
     }
   } else {
     alert("Please drop a PDF file")
   }
 }


 // Handler for "Upload Files" button
 const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
   if (e.target.files) {
     const filesArray = Array.from(e.target.files);
     setUploadedFiles(filesArray);
     console.log("[DEBUG] Context files selected:", filesArray.map(f => f.name));
   }
 };
 const handleUploadFilesClick = () => {
   filesInputRef.current?.click();
 };


 // Handler to remove a file from uploadedFiles
 const handleRemoveFile = (idx: number) => {
   setUploadedFiles(files => files.filter((_, i) => i !== idx));
 };


 const handleAutofill = async () => {
   if (!uploadedFile) return;
   setAutofillLoading(true);
   setAutofillError(null);
   setAutofillResult(null);
   setAutofillStep("Uploading PDF...");
   setAutofillProgress(0);
  
   try {
     // Step 1: Upload PDF and context files (if any) and get job ID immediately
     const formData = new FormData();
     formData.append("file", uploadedFile);
     // Attach context files if any were uploaded via the bottom button
     if (uploadedFiles.length > 0) {
       uploadedFiles.forEach((file) => {
         formData.append("context_files", file);
       });
     }
     console.log("[DEBUG] handleAutofill: PDF file to upload:", uploadedFile.name);
     console.log("[DEBUG] handleAutofill: Context files to upload:", uploadedFiles.map(f => f.name));
     const response = await fetch("http://127.0.0.1:8000/api/parse-pdf/", {
       method: "POST",
       body: formData,
     });
    
     if (!response.ok) {
       throw new Error("Failed to upload PDF");
     }
    
     const uploadData = await response.json();
     const jobId = uploadData.job_id;
    
     if (!jobId) {
       throw new Error("No job ID received from LlamaParse");
     }
    
     console.log("PDF uploaded, job ID:", jobId);
     setAutofillStep("Parsing PDF content...");
     setAutofillProgress(10); // Upload complete
    
     // Step 2: Poll for completion status
     let attempts = 0;
     const maxAttempts = 60; // 3 minutes with 3-second intervals
     setAutofillMaxAttempts(maxAttempts);
    
     while (attempts < maxAttempts) {
       attempts++;
       const progressPercent = Math.min(10 + (attempts / maxAttempts) * 80, 90); // 10% to 90%
       setAutofillProgress(progressPercent);
       setAutofillStep(`Parsing PDF content... (${attempts}/${maxAttempts})`);
      
       // Check status
       const statusResponse = await fetch(`http://127.0.0.1:8000/api/parse-pdf/status/${jobId}`);
       if (!statusResponse.ok) {
         throw new Error("Failed to check parsing status");
       }
      
       const statusData = await statusResponse.json();
       console.log(`Attempt ${attempts}: Status = ${statusData.status}`);
      
       if (statusData.status === "SUCCESS" || statusData.status === "COMPLETED") {
         // Get the result
         setAutofillStep("Getting parsed content...");
         setAutofillProgress(95);
         const resultResponse = await fetch(`http://127.0.0.1:8000/api/parse-pdf/result/${jobId}`);
        
         if (!resultResponse.ok) {
           throw new Error("Failed to get parsing result");
         }
        
         const resultData = await resultResponse.json();
         console.log("Parse result:", resultData);
        
         if (resultData.status === "completed") {
           setAutofillStep("Complete!");
           setAutofillProgress(100);
           setAutofillResult(resultData);
          
           // Populate form fields with AI results
           if (resultData.ai_result) {
             const aiData = resultData.ai_result;
             console.log("AI Result:", aiData);
             console.log("AI Result keys:", Object.keys(aiData));
            
             // Set the title
             if (aiData.title) {
               console.log("Setting title:", aiData.title);
               setName(aiData.title);
             } else {
               console.log("No title found in AI result");
             }
            
             // Set the description
             if (aiData.description) {
               console.log("Setting description:", aiData.description);
               setDescription(aiData.description);
             } else {
               console.log("No description found in AI result");
               console.log("Description field value:", aiData.description);
             }
            
             // Set the learning outcomes
             if (aiData.learning_outcomes && Array.isArray(aiData.learning_outcomes)) {
               console.log("Setting learning outcomes:", aiData.learning_outcomes);
               setLearningOutcomes(aiData.learning_outcomes.join('\n'));
             } else {
               console.log("No learning outcomes found in AI result");
             }
           } else {
             console.log("No AI result found in response:", resultData);
             console.log("Full result data:", resultData);
           }
          
           return;
         } else {
           throw new Error(`Failed to get result: ${resultData.error}`);
         }
        
       } else if (statusData.status === "FAILED") {
         throw new Error(`Parsing failed: ${statusData.error || 'Unknown error'}`);
       } else if (statusData.status === "PENDING") {
         // Wait before next attempt
         await new Promise(resolve => setTimeout(resolve, 3000));
         continue;
       } else {
         // Unknown status, wait and continue
         console.log(`Unknown status: ${statusData.status}, waiting...`);
         await new Promise(resolve => setTimeout(resolve, 3000));
         continue;
       }
     }
    
     // Max attempts reached
     throw new Error("Parsing timed out. Please try again.");
    
   } catch (err: any) {
     setAutofillError(err.message || "Unknown error");
     console.error("Autofill error:", err);
   } finally {
     setAutofillLoading(false);
     setAutofillStep("");
     setAutofillProgress(0);
   }
 };


 // Helper to extract likely player name from the title
 function extractPlayerName(title: string) {
   if (!title) return "";
   // e.g., "Greg James at Sun Microsystems" => "Greg James"
   const match = title.match(/^([^,\-@]+?)(?:\s+at|\s+in|,|\-|$)/i);
   return match ? match[1].trim() : title.trim();
 }


 // Helper to normalize names for comparison
 function normalizeName(name: string) {
   return name
     .replace(/[^a-zA-Z ]/g, "") // Remove punctuation
     .toLowerCase()
     .trim();
 }


 function isLikelySamePerson(playerName: string, personaName: string) {
   const nPlayer = normalizeName(playerName);
   const nPersona = normalizeName(personaName);
   if (!nPlayer || !nPersona) return false;
   if (nPlayer === nPersona) return true;
   // Split into words and check for overlap
   const playerWords = nPlayer.split(" ").filter(Boolean);
   const personaWords = nPersona.split(" ").filter(Boolean);
   const overlap = playerWords.filter(word => personaWords.includes(word));
   return overlap.length >= 2; // At least first and last name match
 }


 // Helper to extract likely player names from the title and description
 function extractPlayerNames(title: string, description: string) {
   const names: string[] = [];
   // Extract all 'Firstname Lastname' patterns from the entire description
   if (description) {
     const nameMatches = [...description.matchAll(/([A-Z][a-z]+ [A-Z][a-z]+)/g)];
     for (const match of nameMatches) {
       const name = match[1].trim();
       if (!names.includes(name)) names.push(name);
     }
   }
   // Fallback: try to extract from the title
   if (title) {
     const match = title.match(/([A-Z][a-z]+ [A-Z][a-z]+)/);
     if (match && !names.includes(match[1].trim())) names.push(match[1].trim());
   }
   return names;
 }


 function isLikelySamePersonFuzzy(playerNames: string[], personaName: string) {
   const nPersona = normalizeName(personaName);
   return playerNames.some(playerName => {
     const nPlayer = normalizeName(playerName);
     const playerWords = nPlayer.split(" ").filter(Boolean);
     // Require all player words (e.g., first and last name) to be present in persona name
     return playerWords.length > 1 && playerWords.every(word => nPersona.includes(word));
   });
 }


 // When autofillResult changes, update personas state
 useEffect(() => {
   if (
     autofillResult &&
     autofillResult.ai_result &&
     Array.isArray(autofillResult.ai_result.personas)
   ) {
     const playerNames = extractPlayerNames(name, description);
     console.log("[DEBUG] Extracted player names:", playerNames);
     const mainCharacter = playerNames[0]?.toLowerCase().trim();
     autofillResult.ai_result.personas.forEach((persona: any) => {
       console.log(`[DEBUG] Persona: '${persona.name}', Excluded: ${persona.name?.toLowerCase().trim() === mainCharacter}`);
     });
     const filtered = autofillResult.ai_result.personas.filter((persona: any) => {
       return persona.name?.toLowerCase().trim() !== mainCharacter;
     }).map((persona: any) => ({
       ...persona,
       traits: { ...persona.traits }, // editable traits
       defaultTraits: { ...persona.traits } // original LLM traits
     }));
     setPersonas(filtered);
   }
 }, [autofillResult, name, description]);


 // Update persona traits handler
 const handleTraitsChange = (idx: number, newTraits: any) => {
   setPersonas(personas => personas.map((p, i) => i === idx ? { ...p, traits: { ...newTraits } } : p));
 };


 // Save persona edits handler
 const handleSavePersona = (idx: number, updatedPersona: any) => {
   setPersonas(personas => personas.map((p, i) => i === idx ? { ...updatedPersona } : p));
   setEditingIdx(null);
 };


 // Delete persona handler
 const handleDeletePersona = (idx: number) => {
   setPersonas(personas => personas.filter((_, i) => i !== idx));
   setEditingIdx(null);
 };


  return (
    <div className="min-h-screen bg-white text-black flex flex-col items-center py-10 px-2">
      {/* Left overlay sidebar */}
      <div className="fixed top-0 left-0 h-full w-72 z-50 bg-black shadow-2xl flex flex-col items-start pl-8 pt-8">
        <h1 className="mb-10 text-white text-xl font-bold mb-6">
          Simulation Builder
        </h1>
        <Link href="/dashboard" className="mb-6">
          <button className="bg-white text-black rounded px-4 py-2 font-medium shadow hover:bg-gray-200 transition">Back to Dashboard</button>
        </Link>
        {/* Add sidebar navigation or content here */}
      </div>
      {/* Add left padding to prevent content from being hidden under the sidebar */}
      <div className="w-72 h-0" />
      {/* Top overlay bar */}
      <div className="fixed top-0 left-0 w-full z-40 bg-white shadow-lg flex items-center justify-between h-14 px-8 border-b border-black">
        <span className="text-lg font-semibold text-black">Simulation Builder</span>
        <div className="flex gap-4">
          <button className="bg-white text-black rounded px-4 py-2 font-medium shadow border border-black hover:bg-black hover:text-white transition">Save</button>
          <button className="bg-black text-white rounded px-4 py-2 font-medium shadow border border-black hover:bg-white hover:text-black transition">Publish</button>
        </div>
      </div>
      {/* Add top padding to prevent content from being hidden under the bar */}
      <div className="h-14" />
      {/* Main content shifted further right to avoid sidebar overlap */}
      <div className="pl-[26rem] w-full">
        {/* Header and Upload Row */}
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 items-start">
          {/* Left: Title and Subtitle */}
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold">Upload your Business Case Study</h1>
            <p className="text-black text-sm">We will analyze the contents and autofill the configuration for you.</p>
          </div>
          {/* Right: Drag and Drop File Upload Box */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 flex flex-col items-center justify-center min-h-[120px] cursor-pointer ${
              isDragOver 
                ? 'border-black bg-black/10 scale-105' 
                : uploadedFile && uploadedFile.type === "application/pdf"
                ? 'border-black bg-black/5'
                : 'border-black bg-white hover:bg-black/5'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploadedFile && uploadedFile.type === "application/pdf" ? (
              <span className="flex flex-col items-center">
                {/* Simple PDF icon using SVG */}
                <svg className="h-10 w-10 mx-auto mb-2 text-black" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6z" />
                  <path d="M14 2v6h6" />
                </svg>
                <span className="text-xs text-black font-semibold">PDF attached</span>
              </span>
            ) : (
              <Upload className={`h-10 w-10 mx-auto mb-2 ${isDragOver ? 'text-black' : 'text-black/50'}`} />
            )}
            
            {!(uploadedFile && uploadedFile.type === "application/pdf") && (
              <span className={`font-medium ${isDragOver ? 'text-black' : 'text-black/70'}`}>
                {isDragOver ? (
                  <span>Drop your PDF here</span>
                ) : (
                  <span><span className="underline">Click here</span> to upload your PDF or drag and drop</span>
                )}
              </span>
            )}
            
            <input
              id="file-upload"
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleFileChange}
              ref={fileInputRef}
            />
            
            {uploadedFile && (
              <div className="mt-2 text-black text-sm font-medium">{uploadedFile.name}</div>
            )}
          </div>
          <div className="flex gap-2 justify-right"></div>
          {/* Buttons directly below the upload box, perfectly aligned */}
          {uploadedFile && (
            <div className="flex ml-25 gap-2 justify-right">
              {/* Choose a different file */}
              <label htmlFor="file-upload" className="cursor-pointer m-0">
                <button
                  type="button"
                  onClick={handleChooseDifferentFile}
                  className="bg-white text-black rounded px-4 py-2 font-medium shadow border border-black w-full h-full align-middle hover:bg-black hover:text-white transition"
                >
                  Choose a different file
                </button>
              </label>
              {/* Use and autofill */}
              <button
                className="bg-black text-white rounded px-2 py-2 font-medium shadow border border-black w-1000 h-10 align-middle flex items-center justify-center hover:bg-white hover:text-black transition"
                onClick={handleAutofill}
                disabled={autofillLoading}
              >
                <Sparkles className="mr-2 h-4 w-4 text-white inline" />
                Use and autofill
              </button>
            </div>
          )}
          {/* Show loading progress */}
          {autofillLoading && (
            <div className="mt-4 p-4 bg-black/5 rounded-lg border border-black">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-black">{autofillStep}</span>
                <span className="text-xs text-black">{Math.round(autofillProgress)}%</span>
              </div>
              <Progress value={autofillProgress} className="w-full h-2 bg-black/10" />
            </div>
          )}
          
          {/* Show error */}
          {autofillError && (
            <div className="mt-4 p-4 bg-white rounded-lg border border-black">
              <div className="flex items-center">
                <span className="text-black font-medium">Error:</span>
                <span className="text-black ml-2">{autofillError}</span>
              </div>
            </div>
          )}
          
          {/* Show success message */}
          {autofillResult && autofillStep === "Complete!" && (
            <div className="mt-4 p-4 bg-black/5 rounded-lg border border-black">
              <div className="flex items-center">
                <span className="text-black font-medium">✓ Success!</span>
                <span className="text-black ml-2">PDF content has been mapped to your form fields.</span>
              </div>
            </div>
          )}
        </div>

        {/* Accordions */}
        <div className="w-full max-w-4xl">
          <Accordion type="multiple" className="space-y-6" defaultValue={['info', 'personas', 'timeline']}>
            {/* Information Accordion */}
            <AccordionItem value="info">
              <AccordionTrigger className="flex items-center gap-2 text-lg font-semibold justify-start text-left text-black">
                <Info className="h-5 w-5 text-black" />
                Information
                <span className="ml-2 text-black text-sm font-normal">The overall description of the simulation. This is the foundation and sense of direction.</span>
              </AccordionTrigger>
              <AccordionContent className="overflow-visible" style={{ overflow: 'visible' }}>
                <div className="space-y-5 pt-4 w-full mx-auto overflow-visible">
                  <div className="overflow-visible focus-within:overflow-visible">
                    <Label htmlFor="name" className="text-black">Name</Label>
                    <Input id="name" value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full box-border p-2 bg-white text-black border border-black" />
                  </div>
                  <div className="overflow-visible focus-within:overflow-visible rounded-none">
                    <Label htmlFor="description" className="text-black">Description/Background</Label>
                    <Textarea 
                      id="description" 
                      value={description} 
                      onChange={e => setDescription(e.target.value)} 
                      className="mt-1 w-full overflow-visible rounded-none z-10 p-2 min-h-[200px] resize-y bg-white text-black border border-black" 
                      style={{ minHeight: '200px', maxHeight: '400px' }}
                    />
                  </div>
                  <div className="overflow-visible focus-within:overflow-visible">
                    <Label htmlFor="learning-outcomes" className="text-black">Learning Outcomes</Label>
                    <Textarea 
                      id="learning-outcomes" 
                      value={learningOutcomes} 
                      onChange={e => setLearningOutcomes(e.target.value)} 
                      className="mt-1 w-full box-border p-2 min-h-[200px] resize-y bg-white text-black border border-black" 
                      style={{ minHeight: '200px', maxHeight: '400px' }}
                    />
                  </div>
                            <div>
                    <Label className="block mb-1 text-black">Files</Label>
                    <span className="block text-black text-xs mb-2">Use this to give more context to the simulation</span>
                    <Button variant="outline" className="bg-white text-black border border-black">Upload Files</Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Personas Accordion */}
            <AccordionItem value="personas">
              <AccordionTrigger className="flex items-center gap-2 text-lg font-semibold justify-start text-left text-black">
                <Users className="h-5 w-5 text-black" />
                Personas
                <span className="ml-2 text-black text-sm font-normal">The characters the user will interact during the simulation with their own personality and goals.</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col items-center py-6">
                  <Button onClick={handleAddPersona} variant="outline" className="w-60 bg-white text-black border border-black">Add new persona</Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Timeline Accordion */}
            <AccordionItem value="timeline">
              <AccordionTrigger className="flex items-center gap-2 text-lg font-semibold justify-start text-left text-black">
                <Activity className="h-5 w-5 text-black" />
                Timeline
                <span className="ml-2 text-black text-sm font-normal">These are the sequence of events the user needs to solve for during the simulation.</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="py-4">
                  <p className="text-black text-sm mb-6">Think of each segment as a self-contained mini-level in your simulation. Arrange them from top to bottom, this will be the sequence each scene will take place in.</p>
                  <div className="flex flex-col items-center">
                    <Button onClick={handleAddScene} variant="outline" className="w-60 bg-white text-black border border-black">Add new Scene</Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </div>
  )
}
