"use client"

import React, { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import devScenario from "./chatboxDevScenario.json";
import { Paperclip, FileText, StickyNote, LayoutGrid, Send } from "lucide-react";

export default function ChatBoxPage() {
  const [messages, setMessages] = useState<{ sender: "You" | "AI" | "Narrator"; text: string }[]>([])
  const [input, setInput] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [scenarioLoaded, setScenarioLoaded] = useState(false);
  const [simulationStarted, setSimulationStarted] = useState(false);
  const [currentPhaseIdx, setCurrentPhaseIdx] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Extract scenario data
  const scenario = devScenario;
  const caseStudy = scenario.case_study;
  const timeline = caseStudy.simulation_timeline;
  const phases = timeline.phases;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isExpanded])

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
    setMessages([
      { sender: "AI", text: `Welcome to the simulation: ${caseStudy.title}\n\n${caseStudy.description}\n\nPhase 1: ${phases[0].title}\n${phases[0].activities.join(" ")}` }
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
    const userMsg = { sender: "You" as const, text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setAttempts(prev => prev + 1);
    const phase = currentPhaseIdx !== null ? phases[currentPhaseIdx] : null;
    if (!phase) return;

    // Get AI response from backend
    const aiResponse = await getBackendSimulationResponse(input, phase);
    // Split AI response by persona (e.g., lines starting with 'Name (Role):' or 'Narrator:')
    const splitPersonaMessages = (text: string) => {
      const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
      const personaPattern = /^(Narrator:|[A-Za-z .'-]+ \([^)]+\):)/;
      return lines.map(line => {
        if (line.startsWith("Narrator:")) {
          return { sender: "Narrator" as const, text: line.replace(/^Narrator:\s*/, "") };
        }
        return { sender: "AI" as const, text: line };
      });
    };
    const aiMessages = splitPersonaMessages(aiResponse);
    setMessages(prev => [...prev, ...aiMessages]);

    // Check for phase progression (simple heuristic: if AI says "move to next phase" or attempts >= 5)
    const shouldAdvance =
      /move to the next phase|let's proceed|advance to the next phase|move on to the next phase/i.test(aiResponse) ||
      attempts + 1 >= 5;

    if (shouldAdvance) {
      // If last phase, complete simulation
      if (currentPhaseIdx !== null && currentPhaseIdx + 1 >= phases.length) {
        setIsComplete(true);
        setMessages(prev => [
          ...prev,
          { sender: "AI", text: "Simulation complete! Congratulations, you have finished all phases." }
        ]);
        return;
      }
      // Otherwise, move to next phase
      setTimeout(() => {
        setCurrentPhaseIdx(idx => (idx !== null ? idx + 1 : 0));
        setAttempts(0);
        setMessages(prev => [
          ...prev,
          { sender: "AI", text: `---\nPhase ${currentPhaseIdx !== null ? phases[currentPhaseIdx + 1].phase : 1}: ${phases[currentPhaseIdx !== null ? currentPhaseIdx + 1 : 0].title}\n${phases[currentPhaseIdx !== null ? currentPhaseIdx + 1 : 0].activities.join(" ")}` }
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
        className={`w-full max-w-3xl mx-auto bg-white rounded-2xl shadow-xl flex flex-col border border-black/10 transition-all duration-300 ${
          isExpanded ? "h-[95vh] max-w-5xl" : "h-[70vh]"
        }`}
        style={isExpanded ? { position: "fixed", top: 20, left: 0, right: 0, zIndex: 50 } : {}}
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
            <Button
              className="bg-gray-700 text-white border border-gray-700 hover:bg-white hover:text-gray-700 transition text-xs px-3 py-1 rounded-md"
              onClick={() => setIsExpanded(exp => !exp)}
            >
              {isExpanded ? "Collapse" : "Expand"}
            </Button>
          </div>
        </header>
        {/* Tabs */}
        <div className="flex items-center gap-6 px-8 pt-2 pb-1 border-b border-black/10 bg-white">
          <div className="flex gap-6 text-sm font-medium">
            <span className="text-black border-b-2 border-black pb-1 cursor-pointer">Chat</span>
            <span className="text-black/40 hover:text-black cursor-pointer flex items-center gap-1"><FileText className="w-4 h-4" /> Documents</span>
            <span className="text-black/40 hover:text-black cursor-pointer flex items-center gap-1"><StickyNote className="w-4 h-4" /> Notes</span>
            <span className="text-black/40 hover:text-black cursor-pointer flex items-center gap-1"><LayoutGrid className="w-4 h-4" /> Overview</span>
          </div>
        </div>
        {/* Simulation description */}
        {scenarioLoaded && !simulationStarted && (
          <div className="px-8 py-6 border-b border-black/10 bg-white">
            <div className="text-xl font-bold mb-2">{caseStudy.title}</div>
            <div className="text-black/80 mb-4 text-sm leading-relaxed">{caseStudy.description}</div>
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
            <div className="text-xs text-black/60">Attempt {attempts + 1} of 5</div>
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
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${msg.sender === "You" ? "items-end" : "items-start"}`}
              >
                <span className={`text-xs font-semibold mb-1 ${msg.sender === "You" ? "text-black/80" : "text-black/60"}`}>{msg.sender === "AI" ? "AI" : msg.sender}</span>
                <span
                  className={
                    msg.sender === "You"
                      ? "bg-black text-white border border-black rounded-2xl px-4 py-2 mb-2 max-w-[80%] text-right text-sm"
                      : "bg-gray-100 text-black border border-black/10 rounded-2xl px-4 py-2 mb-2 max-w-[80%] text-left text-sm"
                  }
                >
                  {msg.text}
                </span>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
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