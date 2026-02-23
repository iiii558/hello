import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'motion/react';
import { Play, Pause, RefreshCw, Info } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// Constants for simulation
const G = 1; // Gravitational constant (normalized)
const M = 1000; // Mass of Jupiter (normalized)
const SEMI_MAJOR_AXIS = 200; // Average distance (pixels)

interface SimulationState {
  angle: number; // True anomaly (radians)
  distance: number;
  velocity: number;
  tidalForce: number;
  heating: number;
  time: number;
}

const IoSimulation: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [eccentricity, setEccentricity] = useState(0.2); // Exaggerated for visual effect (real is ~0.004)
  const [speed, setSpeed] = useState(1);
  const [showOrbitPath, setShowOrbitPath] = useState(true);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const stateRef = useRef<SimulationState>({
    angle: 0,
    distance: SEMI_MAJOR_AXIS,
    velocity: 0,
    tidalForce: 0,
    heating: 0,
    time: 0,
  });

  const [interactionMode, setInteractionMode] = useState<'orbit' | 'manual'>('orbit');
  const [isDragging, setIsDragging] = useState(false);
  const [manualPos, setManualPos] = useState({ x: SEMI_MAJOR_AXIS, y: 0 });

  // History for the chart
  const [history, setHistory] = useState<any[]>([]);
  const historyRef = useRef<any[]>([]);

  // ... existing refs ...

  // Handle Dragging
  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (interactionMode !== 'manual') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    const x = clientX - rect.left - dimensions.width / 2;
    const y = clientY - rect.top - dimensions.height / 2;
    
    // Check if clicking near Io (allow some tolerance)
    const dx = x - manualPos.x;
    const dy = y - manualPos.y;
    if (Math.sqrt(dx*dx + dy*dy) < 40) {
        setIsDragging(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || interactionMode !== 'manual') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    const x = clientX - rect.left - dimensions.width / 2;
    const y = clientY - rect.top - dimensions.height / 2;
    
    // Clamp to keep it somewhat on screen but allow freedom
    setManualPos({ x, y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Update Physics (Modified)
  const updatePhysics = () => {
    // ... existing logic ...
    if (interactionMode === 'manual') {
        // In manual mode, we just update the state based on manualPos
        const r = Math.sqrt(manualPos.x * manualPos.x + manualPos.y * manualPos.y);
        const angle = Math.atan2(manualPos.y, manualPos.x);
        
        // Tidal force is proportional to 1/r^3
        // Scale it so it's visible. At 200px (orbit), force is ~0.12
        const tidalForce = 1000000 / (r * r * r);
        
        // Heating is instantaneous in manual mode for feedback
        const heating = (tidalForce - 0.05) * 20;

        stateRef.current = {
            angle,
            distance: r,
            velocity: 0,
            tidalForce,
            heating,
            time: stateRef.current.time + 1
        };
        
        // Update history
        if (stateRef.current.time % 5 === 0) {
             const dataPoint = {
                time: stateRef.current.time,
                distance: Math.round(r),
                tidalForce: tidalForce.toFixed(2),
                heating: heating.toFixed(2),
            };
            const newHistory = [...historyRef.current, dataPoint];
            if (newHistory.length > 50) newHistory.shift();
            historyRef.current = newHistory;
            setHistory(newHistory);
        }
        return;
    }
    
    // ... existing orbital logic ...
    const state = stateRef.current;
    // ... rest of orbital logic
    
    // Kepler's Second Law approximation for angular velocity:
    // r = a(1-e^2) / (1 + e*cos(theta))
    
    // Calculate current distance (r)
    const r = (SEMI_MAJOR_AXIS * (1 - eccentricity * eccentricity)) / (1 + eccentricity * Math.cos(state.angle));
    
    const baseOmega = 0.02 * speed; 
    const omega = baseOmega * (SEMI_MAJOR_AXIS / r) ** 2;
    
    let newAngle = state.angle + omega;
    if (newAngle > 2 * Math.PI) {
      newAngle -= 2 * Math.PI;
    }

    const tidalForce = 1000000 / (r * r * r);
    const heating = (tidalForce - 0.05) * 20;

    stateRef.current = {
      angle: newAngle,
      distance: r,
      velocity: omega * r,
      tidalForce,
      heating,
      time: state.time + 1,
    };

    if (state.time % 5 === 0) {
      const dataPoint = {
        time: state.time,
        distance: Math.round(r),
        tidalForce: tidalForce.toFixed(2),
        heating: heating.toFixed(2),
      };
      
      const newHistory = [...historyRef.current, dataPoint];
      if (newHistory.length > 50) newHistory.shift();
      historyRef.current = newHistory;
      setHistory(newHistory);
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    window.addEventListener('resize', updateSize);
    updateSize();

    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { width, height } = dimensions;
    const dpr = window.devicePixelRatio || 1;
    
    // Update canvas internal resolution to match display size * pixel ratio
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        // Reset transform is not needed because we set it every frame, 
        // but we need to scale the context if we don't do it in draw
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Scale all drawing operations by dpr
    ctx.resetTransform();
    ctx.scale(dpr, dpr);

    const centerX = width / 2;
    const centerY = height / 2;
    const state = stateRef.current;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw Background Stars (static for now, could be pre-rendered)
    // ...

    // Draw Orbit Path
    if (showOrbitPath) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      
      // Draw ellipse
      // The focus is at (centerX, centerY). 
      // We need to plot points.
      for (let theta = 0; theta <= 2 * Math.PI; theta += 0.05) {
        const r_path = (SEMI_MAJOR_AXIS * (1 - eccentricity * eccentricity)) / (1 + eccentricity * Math.cos(theta));
        const x = centerX + r_path * Math.cos(theta);
        const y = centerY + r_path * Math.sin(theta);
        if (theta === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // Draw Jupiter (Focus)
    // Jupiter is at one focus. In our polar equation r = p / (1+e*cos(theta)), the origin (0,0) is the focus.
    // So Jupiter is at (centerX, centerY).
    const jupiterRadius = 40;
    const jupiterGradient = ctx.createRadialGradient(centerX - 10, centerY - 10, 5, centerX, centerY, jupiterRadius);
    jupiterGradient.addColorStop(0, '#E8B685'); // Light bands
    jupiterGradient.addColorStop(0.5, '#C68E56'); // Darker bands
    jupiterGradient.addColorStop(1, '#8C5E2E'); // Shadow
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, jupiterRadius, 0, 2 * Math.PI);
    ctx.fillStyle = jupiterGradient;
    ctx.fill();
    
    // Draw Jupiter Bands
    ctx.save();
    ctx.clip();
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 4;
    for(let i = -jupiterRadius; i < jupiterRadius; i+=10) {
        ctx.moveTo(centerX - jupiterRadius, centerY + i);
        ctx.lineTo(centerX + jupiterRadius, centerY + i);
    }
    ctx.stroke();
    ctx.restore();


    // Draw Io
    const ioX = centerX + state.distance * Math.cos(state.angle);
    const ioY = centerY + state.distance * Math.sin(state.angle);
    
    // Calculate Io distortion
    // Stretch along the radial vector
    // Base radius
    const ioRadius = 12;
    // Stretch factor based on tidal force
    const stretch = 1 + (state.tidalForce * 0.05 * eccentricity * 10); // Exaggerated stretch
    
    ctx.save();
    ctx.translate(ioX, ioY);
    ctx.rotate(state.angle); // Rotate to align with radial vector (tidal locking)
    
    // Draw Tidal Bulge (Ellipse)
    ctx.beginPath();
    // x-axis is radial direction (stretched), y-axis is tangential (squashed to conserve volume approx)
    // Volume conservation: x * y * z = r^3. If x scales by S, y and z scale by 1/sqrt(S).
    const scaleX = stretch;
    const scaleY = 1 / Math.sqrt(stretch);
    
    ctx.ellipse(0, 0, ioRadius * scaleX, ioRadius * scaleY, 0, 0, 2 * Math.PI);
    
    // Color based on "heating" (stress)
    // Normal: Yellow (#FFE135). Hot: Orange/Red (#FF4500).
    // Interpolate color roughly
    const heatFactor = Math.min(Math.max((state.tidalForce - 0.08) * 20, 0), 1);
    
    // Simple color lerp
    // Yellow: 255, 225, 53
    // Red: 255, 69, 0
    const rCol = 255;
    const gCol = Math.round(225 * (1 - heatFactor) + 69 * heatFactor);
    const bCol = Math.round(53 * (1 - heatFactor));
    
    ctx.fillStyle = `rgb(${rCol}, ${gCol}, ${bCol})`;
    ctx.fill();

    // Draw Grid / Rock Texture Lines to show deformation
    ctx.save();
    ctx.clip(); // Clip to the ellipse
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;

    // Longitudinal lines (curved)
    for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.ellipse(0, 0, ioRadius * scaleX * 0.8, ioRadius * scaleY * (0.2 + Math.abs(i)*0.2), 0, 0, 2 * Math.PI);
        ctx.stroke();
    }
    // Latitudinal lines (vertical in this rotated frame)
    for (let i = -2; i <= 2; i++) {
        const xPos = i * (ioRadius * scaleX / 3);
        ctx.beginPath();
        ctx.moveTo(xPos, -ioRadius * scaleY);
        ctx.lineTo(xPos, ioRadius * scaleY);
        ctx.stroke();
    }
    ctx.restore();
    
    // Add "volcanoes" if hot
    if (heatFactor > 0.3) {
        ctx.fillStyle = 'rgba(255, 50, 0, 0.8)';
        ctx.beginPath();
        ctx.arc(ioRadius * scaleX * 0.8, 0, 3, 0, 2 * Math.PI); // Sub-Jupiter point
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(-ioRadius * scaleX * 0.8, 0, 3, 0, 2 * Math.PI); // Anti-Jupiter point
        ctx.fill();
    }

    ctx.restore();
  };

  const animate = () => {
    if (isPlaying || interactionMode === 'manual') {
      updatePhysics();
    }
    draw();
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, eccentricity, speed, showOrbitPath, interactionMode, isDragging, manualPos]);

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white font-sans overflow-hidden">
      {/* Header */}
      <header className="p-6 border-b border-white/10 flex justify-between items-center z-10 bg-[#050505]/80 backdrop-blur-md">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Io Tidal Heating <span className="text-[#F27D26]">Simulator</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Visualizing gravitational stress and orbital resonance
          </p>
        </div>
        <div className="flex gap-4">
            <a href="https://en.wikipedia.org/wiki/Tidal_heating_of_Io" target="_blank" rel="noreferrer" className="text-xs text-gray-500 hover:text-white transition-colors flex items-center gap-1">
                <Info size={14} /> Learn More
            </a>
        </div>
      </header>

      <div className="flex flex-1 relative">
        {/* Main Visualization */}
        <div 
            ref={containerRef} 
            className={`flex-1 relative bg-[radial-gradient(circle_at_center,_#1a1a1a_0%,_#000000_100%)] overflow-hidden ${interactionMode === 'manual' ? 'cursor-move' : ''}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
        >
          <canvas
            ref={canvasRef}
            className="block"
          />
          
          {/* Overlay Stats */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute top-4 left-4 font-mono text-xs space-y-2 pointer-events-none"
          >
            <div className="bg-black/50 p-3 rounded border border-white/10 backdrop-blur">
              <div className="text-gray-400 uppercase tracking-wider mb-1">Distance (km x10³)</div>
              <div className="text-xl text-white">{(stateRef.current.distance * 2).toFixed(0)}</div>
            </div>
            <div className="bg-black/50 p-3 rounded border border-white/10 backdrop-blur">
              <div className="text-gray-400 uppercase tracking-wider mb-1">Tidal Stress (Rel)</div>
              <div className="text-xl text-[#F27D26]">{stateRef.current.tidalForce.toFixed(3)}</div>
            </div>
          </motion.div>
        </div>

        {/* Sidebar Controls & Data */}
        <div className="w-80 border-l border-white/10 bg-[#0a0a0a] flex flex-col z-10">
          
          {/* Controls */}
          <div className="p-6 border-b border-white/10 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Controls</h2>
                <button 
                    onClick={() => {
                        stateRef.current = { ...stateRef.current, angle: 0, time: 0 };
                        setHistory([]);
                        historyRef.current = [];
                        setManualPos({ x: SEMI_MAJOR_AXIS, y: 0 });
                    }}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    title="Reset"
                >
                    <RefreshCw size={16} />
                </button>
            </div>

            {/* Mode Toggle */}
            <div className="bg-white/5 p-1 rounded-lg flex text-xs font-medium">
                <button 
                    onClick={() => {
                        setInteractionMode('orbit');
                        setIsPlaying(true);
                    }}
                    className={`flex-1 py-2 rounded-md transition-colors ${interactionMode === 'orbit' ? 'bg-[#F27D26] text-black' : 'text-gray-400 hover:text-white'}`}
                >
                    Orbit Mode
                </button>
                <button 
                    onClick={() => {
                        setInteractionMode('manual');
                        setIsPlaying(false);
                    }}
                    className={`flex-1 py-2 rounded-md transition-colors ${interactionMode === 'manual' ? 'bg-[#F27D26] text-black' : 'text-gray-400 hover:text-white'}`}
                >
                    Manual Drag
                </button>
            </div>

            {/* Play/Pause (Only for Orbit) */}
            {interactionMode === 'orbit' && (
            <div className="flex justify-center">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-16 h-16 rounded-full bg-[#F27D26] hover:bg-[#ff8f40] text-black flex items-center justify-center transition-transform active:scale-95 shadow-[0_0_20px_rgba(242,125,38,0.3)]"
              >
                {isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" className="ml-1" />}
              </button>
            </div>
            )}

            {interactionMode === 'manual' && (
                <div className="p-4 bg-[#F27D26]/10 border border-[#F27D26]/20 rounded-lg text-center">
                    <p className="text-[#F27D26] text-sm font-medium">Drag Io to see tidal effects</p>
                    <p className="text-gray-500 text-[10px] mt-1">Move closer to Jupiter to increase stress</p>
                </div>
            )}

            {/* Sliders */}
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-gray-400">Orbital Eccentricity</span>
                  <span className="font-mono">{eccentricity.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.6"
                  step="0.01"
                  value={eccentricity}
                  onChange={(e) => setEccentricity(parseFloat(e.target.value))}
                  className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-[#F27D26]"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  Higher eccentricity = more extreme tidal flexing.
                </p>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-gray-400">Simulation Speed</span>
                  <span className="font-mono">{speed.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="5"
                  step="0.1"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-[#F27D26]"
                />
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="flex-1 p-6 flex flex-col min-h-0">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">Tidal Force History</h2>
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <XAxis dataKey="time" hide />
                  <YAxis domain={['auto', 'auto']} hide />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', fontSize: '12px' }}
                    itemStyle={{ color: '#F27D26' }}
                    labelStyle={{ display: 'none' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="tidalForce" 
                    stroke="#F27D26" 
                    strokeWidth={2} 
                    dot={false} 
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 text-[10px] text-gray-500 text-center">
                Peaks represent Periapsis (closest approach)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IoSimulation;
