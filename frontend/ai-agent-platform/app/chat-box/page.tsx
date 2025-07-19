"use client"

import React, { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import devScenario from "./chatboxDevScenario.json";
import { Paperclip, FileText, StickyNote, LayoutGrid, Send } from "lucide-react";

// Add typing indicator component
const TypingIndicator = () => (
  <div className="flex flex-col items-start">
    <span className="text-xs font-semibold mb-1 text-black/60">AI</span>
    <div className="bg-gray-100 text-black border border-gray-200 rounded-2xl px-4 py-2 mb-2 max-w-[80%] text-left text-sm">
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
      </div>
    </div>
  </div>
);

// Add function to clean up excessive asterisks
const cleanMessageText = (text: string) => {
  // Remove excessive asterisks while preserving intentional formatting
  return text
    .replace(/\*\*\*\*/g, '**') // Replace 4 asterisks with 2
    .replace(/\*\*\*/g, '**')   // Replace 3 asterisks with 2
    .replace(/\*\*Hint →\*\*/g, '*Hint →*') // Clean up hint formatting
    .replace(/\*\*Goal\*\*/g, '*Goal*')     // Clean up goal formatting
    .trim();
};

export default function ChatBoxPage() {
  // Update message type to remove "You"
  const [messages, setMessages] = useState<{ sender: string; text: string }[]>([])
  const [input, setInput] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [scenarioLoaded, setScenarioLoaded] = useState(false);
  const [simulationStarted, setSimulationStarted] = useState(false);
  const [currentPhaseIdx, setCurrentPhaseIdx] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  // Remove isExpanded state
  // const [isExpanded, setIsExpanded] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Add tab navigation state
  const [activeTab, setActiveTab] = useState<"chat" | "documents" | "notes" | "overview">("chat");

  // Extract scenario data
  const scenario = devScenario;
  const caseStudy = scenario.case_study;
  const timeline = caseStudy.simulation_timeline;
  const phases = timeline.phases;

  // Add user character state - moved after caseStudy is defined
  const [userCharacter, setUserCharacter] = useState<string>(caseStudy.characters[0]?.name || "User");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, simulationStarted])

  // Handler for loading scenario from localStorage
  const handleLoadScenario = () => {
    const scenarioStr = localStorage.getItem("savedScenario");
    if (scenarioStr) {
      const scenario = JSON.parse(scenarioStr);
      console.log("[ChatBox] Loaded scenario from localStorage:", scenario);
      setScenarioLoaded(true);
    } else {
      alert("No saved scenario found in localStorage.");
    }
  };

  // Handler for loading hardcoded dev scenario
  const handleLoadDevScenario = () => {
    console.log("[ChatBox] Loaded DEV scenario:", devScenario);
    setScenarioLoaded(true);
  };

  // Handler for starting the simulation
  const handleStartSimulation = () => {
    setSimulationStarted(true);
    setCurrentPhaseIdx(0);
    setAttempts(0);
    setIsComplete(false);
    // Update the initial welcome message to not include phase info
    setMessages([
      { 
        sender: "Narrator", 
        text: `Welcome to the simulation: ${caseStudy.title}\n\n${caseStudy.description}` 
      }
    ]);
  };

  // Backend integration for simulation response
  const getBackendSimulationResponse = async (userInput: string, phase: any) => {
    setIsLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/simulate/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          user_input: userInput,
          phase,
          case_study: caseStudy,
          attempts
        })
      });
      const data = await res.json();
      setIsLoading(false);
      if (data.ai_response) {
        return data.ai_response;
      }
      return "[AI] Sorry, I couldn't generate a response.";
    } catch (err) {
      setIsLoading(false);
      return "[AI] Error contacting simulation backend.";
    }
  };

  // Handler for sending a message
  const handleSend = async () => {
    if (!simulationStarted || isComplete || isLoading) return;
    if (input.trim() === "") return;
    const userMsg = { sender: userCharacter, text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setAttempts(prev => prev + 1);
    const phase = currentPhaseIdx !== null ? phases[currentPhaseIdx] : null;
    if (!phase) return;

    // Get AI response from backend
    const aiResponse = await getBackendSimulationResponse(input, phase);
    // Update splitPersonaMessages to filter out empty messages and use "Narrator" for all AI responses
    const splitPersonaMessages = (text: string): { sender: string; text: string }[] => {
      const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
      return lines.map(line => {
        // Skip empty lines or placeholder content
        if (!line || line === "---" || line.length < 2) {
          return null;
        }
        
        // Extract character name from patterns like "Name (Role):" or "Narrator:"
        const characterMatch = line.match(/^([^:]+):\s*(.*)/);
        if (characterMatch) {
          const [, sender, message] = characterMatch;
          // Clean up the sender name (remove role in parentheses)
          const cleanSender = sender.replace(/\s*\([^)]*\)$/, '').trim();
          // If the message is empty or just whitespace, skip it
          if (!message || message.trim().length < 2) {
            return null;
          }
          return { sender: cleanSender, text: message.trim() };
        }
        
        // For any other AI response, use "Narrator" as sender
        return { sender: "Narrator", text: line };
      }).filter((msg): msg is { sender: string; text: string } => msg !== null); // Remove null entries
    };
    const aiMessages = splitPersonaMessages(aiResponse);
    setMessages(prev => [...prev, ...aiMessages]);

    // Update the phase progression check to include hardcoded trigger
    const shouldAdvance =
      /move to the next phase|let's proceed|advance to the next phase|move on to the next phase/i.test(aiResponse) ||
      /next phase/i.test(input) || // Add hardcoded trigger
      attempts + 1 >= 5;

    // Update phase progression to send separate phase messages
    if (shouldAdvance) {
      // If last phase, complete simulation
      if (currentPhaseIdx !== null && currentPhaseIdx + 1 >= phases.length) {
        setIsComplete(true);
        setMessages(prev => [
          ...prev,
          { sender: "Narrator", text: "Simulation complete! Congratulations, you have finished all phases." }
        ]);
        return;
      }
      // Otherwise, move to next phase
      setTimeout(() => {
        const nextPhaseIdx = currentPhaseIdx !== null ? currentPhaseIdx + 1 : 0;
        const nextPhase = phases[nextPhaseIdx];
        setCurrentPhaseIdx(nextPhaseIdx);
        setAttempts(0);
        // Update phase progression to use JSON goal
        setMessages(prev => [
          ...prev,
          { 
            sender: "Narrator", 
            text: `--- Phase ${nextPhase.phase}: ${nextPhase.title} ---\n\n${nextPhase.activities.join(" ")}\n\nGoal: ${nextPhase.goal || "Complete the phase objectives."}` 
          }
        ]);
      }, 1200);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSend();
  };

  // Get current phase info
  const currentPhase =
    simulationStarted && currentPhaseIdx !== null && phases[currentPhaseIdx]
      ? phases[currentPhaseIdx]
      : null;

  return (
    <div className="min-h-screen bg-[#F7F7F8] text-black flex flex-col items-center py-10 px-2">
      <div
        className="fixed inset-0 bg-white rounded-none shadow-none flex flex-col border border-black/10 transition-all duration-300 z-50"
        style={{ minHeight: '100vh', height: '100vh', maxWidth: '100vw', width: '100vw', borderRadius: 0 }}
      >
        {/* Header with tabs */}
        <header className="flex items-center justify-between px-8 pt-6 pb-2 border-b border-black/10 bg-white rounded-t-2xl">
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight">Simulation</span>
            <span className="text-xs text-black/60 font-medium">Business Case Interactive Chat</span>
          </div>
          <div className="flex gap-2 items-center">
            <Button
              className="bg-black text-white border border-black hover:bg-white hover:text-black transition text-xs px-3 py-1 rounded-md"
              onClick={handleLoadScenario}
            >
              Load Saved
            </Button>
            <Button
              className="bg-blue-700 text-white border border-blue-700 hover:bg-white hover:text-blue-700 transition text-xs px-3 py-1 rounded-md"
              onClick={handleLoadDevScenario}
            >
              Load DEV
            </Button>
            {/* Remove Expand/Collapse button from header */}
          </div>
        </header>
        {/* Tabs */}
        <div className="flex items-center gap-6 px-8 pt-2 pb-1 border-b border-black/10 bg-white">
          <div className="flex gap-6 text-sm font-medium">
            <span 
              className={`cursor-pointer pb-1 ${activeTab === "chat" ? "text-black border-b-2 border-black" : "text-black/40 hover:text-black"}`}
              onClick={() => setActiveTab("chat")}
            >
              Chat
            </span>
            <span 
              className={`cursor-pointer pb-1 flex items-center gap-1 ${activeTab === "documents" ? "text-black border-b-2 border-black" : "text-black/40 hover:text-black"}`}
              onClick={() => setActiveTab("documents")}
            >
              <FileText className="w-4 h-4" /> Documents
            </span>
            <span 
              className={`cursor-pointer pb-1 flex items-center gap-1 ${activeTab === "notes" ? "text-black border-b-2 border-black" : "text-black/40 hover:text-black"}`}
              onClick={() => setActiveTab("notes")}
            >
              <StickyNote className="w-4 h-4" /> Notes
            </span>
            <span 
              className={`cursor-pointer pb-1 flex items-center gap-1 ${activeTab === "overview" ? "text-black border-b-2 border-black" : "text-black/40 hover:text-black"}`}
              onClick={() => setActiveTab("overview")}
            >
              <LayoutGrid className="w-4 h-4" /> Overview
            </span>
          </div>
        </div>
        {/* Simulation description */}
        {activeTab === "overview" && scenarioLoaded && (
          <div className="flex-1 overflow-y-auto px-8 py-6 bg-white">
            <div className="text-xl font-bold mb-4">{caseStudy.title}</div>
            <div className="text-black/80 mb-4 text-sm leading-relaxed">{caseStudy.description}</div>
            
            <div className="mb-4">
              <h3 className="font-semibold text-base mb-2">Your Task:</h3>
              <p className="text-sm text-black/70">Analyze the business challenges and make strategic decisions to guide KasKazi Network through their distribution challenges.</p>
            </div>
            
            <div className="mb-4">
              <h3 className="font-semibold text-base mb-2">Available Agents:</h3>
              <div className="space-y-1">
                {caseStudy.characters.map((char, idx) => (
                  <div key={idx} className="text-sm">
                    <span className="font-mono text-blue-600">@{char.name.toLowerCase().replace(/\s+/g, '_')}</span>
                    <span className="text-black/70">: {char.role}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-yellow-600">💡</span>
                <span className="font-semibold text-sm">Guidance:</span>
              </div>
              <p className="text-sm text-black/70">Use @ to direct questions or statements to specific agents. Type help for guidance.</p>
            </div>
            
            {!simulationStarted && (
              <Button
                className="bg-green-700 text-white border border-green-700 hover:bg-white hover:text-green-700 transition text-md px-4 py-2 rounded-md"
                onClick={handleStartSimulation}
              >
                Start Simulation
              </Button>
            )}
          </div>
        )}
        {activeTab === "chat" && (
          <>
            {/* Simulation description - show full description on initial load */}
            {scenarioLoaded && !simulationStarted && (
              <div className="px-8 py-6 border-b border-black/10 bg-white">
                <div className="text-xl font-bold mb-4">{caseStudy.title}</div>
                <div className="text-black/80 mb-4 text-sm leading-relaxed">{caseStudy.description}</div>
                
                <div className="mb-4">
                  <h3 className="font-semibold text-base mb-2">Your Task:</h3>
                  <p className="text-sm text-black/70">Analyze the business challenges and make strategic decisions to guide KasKazi Network through their distribution challenges.</p>
                </div>
                
                <div className="mb-4">
                  <h3 className="font-semibold text-base mb-2">Available Agents:</h3>
                  <div className="space-y-1">
                    {caseStudy.characters.map((char, idx) => (
                      <div key={idx} className="text-sm">
                        <span className="font-mono text-blue-600">@{char.name.toLowerCase().replace(/\s+/g, '_')}</span>
                        <span className="text-black/70">: {char.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-yellow-600">💡</span>
                    <span className="font-semibold text-sm">Guidance:</span>
                  </div>
                  <p className="text-sm text-black/70">Use @ to direct questions or statements to specific agents.</p>
                </div>
                
                <Button
                  className="bg-green-700 text-white border border-green-700 hover:bg-white hover:text-green-700 transition text-md px-4 py-2 rounded-md"
                  onClick={handleStartSimulation}
                >
                  Start Simulation
                </Button>
              </div>
            )}
            
            {/* Phase info */}
            {simulationStarted && currentPhase && (
              <div className="px-8 py-4 border-b border-black/10 bg-white">
                <div className="font-semibold text-base mb-1">Phase {currentPhase.phase}: {currentPhase.title}</div>
                <div className="text-black/80 mb-1 text-sm">{currentPhase.activities.join(" ")}</div>
                <div className="text-xs text-black/60 mb-2">Attempt {attempts + 1} of 5</div>
                {/* Update the phase info display to use JSON goal */}
                <div className="text-sm text-blue-700 font-medium">
                  Goal: {currentPhase.goal || "Complete the phase objectives."}
                </div>
                {isComplete && (
                  <div className="text-green-700 font-bold mt-2">Simulation complete! Congratulations, you have finished all phases.</div>
                )}
              </div>
            )}
            
            {/* Divider */}
            <div className="w-full h-[1px] bg-black/5" />
            
            {/* Chat area */}
            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-3 bg-white" style={{ minHeight: 0 }}>
              {messages.length === 0 ? (
                <div className="text-black/40 text-center mt-10 text-base">No messages yet. Start the conversation!</div>
              ) : (
                <>
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex flex-col ${msg.sender === userCharacter ? "items-end" : "items-start"}`}
                    >
                      <span className={`text-xs font-semibold mb-1 ${msg.sender === userCharacter ? "text-black/80" : "text-black/60"}`}>
                        {msg.sender === userCharacter ? `You (${userCharacter})` : msg.sender}
                      </span>
                      <span
                        className={
                          msg.sender === userCharacter
                            ? "bg-gray-800 text-white border border-gray-800 rounded-2xl px-4 py-2 mb-2 max-w-[80%] text-right text-sm"
                            : "bg-gray-100 text-black border border-gray-200 rounded-2xl px-4 py-2 mb-2 max-w-[80%] text-left text-sm"
                        }
                      >
                        {cleanMessageText(msg.text)}
                      </span>
                    </div>
                  ))}
                  {isLoading && <TypingIndicator />}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>
          </>
        )}

        {activeTab === "documents" && (
          <div className="flex-1 overflow-y-auto px-8 py-6 bg-white">
            <div className="text-center text-black/40">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Documents tab - Coming soon</p>
            </div>
          </div>
        )}

        {activeTab === "notes" && (
          <div className="flex-1 overflow-y-auto px-8 py-6 bg-white">
            <div className="text-center text-black/40">
              <StickyNote className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Notes tab - Coming soon</p>
            </div>
          </div>
        )}
        {/* Input area */}
        <div className="px-8 py-4 border-t border-black/10 bg-white flex gap-2 items-center">
          <Input
            className="flex-1 bg-white border border-black/10 text-black rounded-2xl px-4 py-2 text-base focus:ring-2 focus:ring-black/20 focus:border-black/30"
            placeholder={simulationStarted ? "Type your message..." : "Start the simulation to chat..."}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!simulationStarted || isComplete || isLoading}
            style={{ minHeight: 44 }}
          />
          <Button
            className="bg-black text-white border border-black hover:bg-white hover:text-black transition rounded-full p-0 w-11 h-11 flex items-center justify-center"
            onClick={handleSend}
            disabled={!simulationStarted || isComplete || isLoading}
            style={{ minWidth: 44, minHeight: 44 }}
          >
            {isLoading ? <span className="animate-pulse">...</span> : <Send className="w-5 h-5" />}
          </Button>
        </div>
      </div>
    </div>
  )
} 