import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Pen, Eraser, Square, Circle, Minus, ArrowUpRight, Undo2, Redo2, Download, LogOut, Sun, Moon, Trash2 } from 'lucide-react';

const SOCKET_URL = import.meta.env.PROD ? window.location.origin : 'http://localhost:3001';
const socket = io(SOCKET_URL);

const COLORS = ['#f8fafc', '#1d1d1f', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];

const generateId = () => Math.random().toString(36).substr(2, 9);

export default function Whiteboard({ roomId, username, onLeave, theme, toggleTheme }) {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  
  const [elements, setElements] = useState([]);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  
  const [action, setAction] = useState('none'); 
  const [tool, setTool] = useState('pen'); 
  const [color, setColor] = useState(theme === 'dark' ? '#f8fafc' : '#1d1d1f');
  
  const [peers, setPeers] = useState([]);
  const [peerCursors, setPeerCursors] = useState({});

  const currentPathRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const context = canvas.getContext('2d');
      context.lineCap = 'round';
      context.lineJoin = 'round';
      contextRef.current = context;
      redraw(elements);
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [elements]);

  useEffect(() => {
    socket.emit('join-room', { roomId, username });

    socket.on('users-update', (users) => {
      setPeers(users.filter(u => u.id !== socket.id));
    });

    socket.on('cursor-move', ({ id, x, y }) => {
      setPeerCursors(prev => ({ ...prev, [id]: { x, y } }));
    });

    socket.on('load-board', (loadedElements) => {
      setElements(loadedElements);
      redraw(loadedElements);
    });

    socket.on('board-update', (updatedElements) => {
      setElements(updatedElements);
      redraw(updatedElements);
    });

    return () => {
      socket.off('users-update');
      socket.off('cursor-move');
      socket.off('load-board');
      socket.off('board-update');
    };
  }, [roomId, username]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          if (e.shiftKey) handleRedo();
          else handleUndo();
        } else if (e.key === 'y') {
          handleRedo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [elements, undoStack, redoStack]);

  const handleUndo = () => {
    if (elements.length === 0) return;
    const lastEl = elements[elements.length - 1];
    const newElements = elements.slice(0, -1);
    setElements(newElements);
    setUndoStack([...undoStack, lastEl]);
    emitBoardUpdate(newElements);
    redraw(newElements);
  };

  const handleRedo = () => {
    if (undoStack.length === 0) return;
    const elToRestore = undoStack[undoStack.length - 1];
    const newElements = [...elements, elToRestore];
    setElements(newElements);
    setUndoStack(undoStack.slice(0, -1));
    emitBoardUpdate(newElements);
    redraw(newElements);
  };

  const clearBoard = () => {
    setElements([]);
    setUndoStack([]);
    setRedoStack([]);
    emitBoardUpdate([]);
    redraw([]);
  };

  const emitBoardUpdate = (updatedElements) => {
    socket.emit('element-update', { roomId, elements: updatedElements });
  };

  const drawElement = (ctx, el) => {
    if (!el) return;

    // True erasing that punches a transparent hole through the canvas
    if (el.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = el.color || '#000';
    }

    ctx.lineWidth = el.strokeWidth || 3;
    ctx.beginPath();

    if (el.type === 'path') {
      if (!el.path || !Array.isArray(el.path) || el.path.length === 0) {
        ctx.globalCompositeOperation = 'source-over'; // reset
        return;
      }
      ctx.moveTo(el.path[0].x, el.path[0].y);
      for (let i = 1; i < el.path.length; i++) {
        ctx.lineTo(el.path[i].x, el.path[i].y);
      }
      ctx.stroke();
    } else if (el.type === 'rect') {
      ctx.strokeRect(el.x || 0, el.y || 0, el.w || 0, el.h || 0);
    } else if (el.type === 'circle') {
      const w = el.w || 0;
      const h = el.h || 0;
      const rx = Math.abs(w / 2);
      const ry = Math.abs(h / 2);
      const cx = (el.x || 0) + w / 2;
      const cy = (el.y || 0) + h / 2;
      ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (el.type === 'line') {
      ctx.moveTo(el.x || 0, el.y || 0);
      ctx.lineTo((el.x || 0) + (el.w || 0), (el.y || 0) + (el.h || 0));
      ctx.stroke();
    } else if (el.type === 'arrow') {
      const x1 = el.x || 0;
      const y1 = el.y || 0;
      const w = el.w || 0;
      const h = el.h || 0;
      const x2 = x1 + w;
      const y2 = y1 + h;
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      
      const headlen = 15;
      const angle = Math.atan2(h, w);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    }
    
    // Always reset composite operation
    ctx.globalCompositeOperation = 'source-over';
  };

  const redraw = (els = elements) => {
    const ctx = contextRef.current;
    if (!ctx) return;
    const canvas = canvasRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (Array.isArray(els)) {
      els.forEach(el => {
        try {
          drawElement(ctx, el);
        } catch (e) {
          console.error("Corrupted element skipped:", e);
        }
      });
    }
    
    if (currentPathRef.current) {
      try {
        drawElement(ctx, currentPathRef.current);
      } catch (e) {}
    }
  };

  const getMouseCoords = (e) => {
    const { clientX, clientY } = e.touches ? e.touches[0] : e;
    return { x: clientX, y: clientY };
  };

  const startDrawing = (e) => {
    const { x, y } = getMouseCoords(e);
    setAction('drawing');
    
    const strokeWidth = tool === 'eraser' ? 30 : 3;
    // We don't need a specific color for the eraser anymore, but we'll assign one just in case
    const strokeColor = color; 

    if (tool === 'pen' || tool === 'eraser') {
      currentPathRef.current = { id: generateId(), type: 'path', tool, path: [{x, y}], color: strokeColor, strokeWidth };
    } else {
      currentPathRef.current = { id: generateId(), type: tool, tool, x, y, w: 0, h: 0, color: strokeColor, strokeWidth };
    }
  };

  const draw = (e) => {
    const { x, y } = getMouseCoords(e);
    
    socket.emit('cursor-move', { roomId, x, y });

    if (action !== 'drawing' || !currentPathRef.current) return;

    if (tool === 'pen' || tool === 'eraser') {
      currentPathRef.current.path.push({ x, y });
    } else {
      currentPathRef.current.w = x - currentPathRef.current.x;
      currentPathRef.current.h = y - currentPathRef.current.y;
    }
    
    redraw(elements);
  };

  const finishDrawing = () => {
    if (action === 'drawing' && currentPathRef.current) {
      const newElements = [...elements, currentPathRef.current];
      setElements(newElements);
      setUndoStack([]);
      emitBoardUpdate(newElements);
    }
    setAction('none');
    currentPathRef.current = null;
    redraw(elements);
  };

  const exportPNG = () => {
    const canvas = canvasRef.current;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `whiteboard-${roomId}.png`;
    link.href = url;
    link.click();
  };

  const tools = [
    { id: 'pen', icon: <Pen size={20} /> },
    { id: 'rect', icon: <Square size={20} /> },
    { id: 'circle', icon: <Circle size={20} /> },
    { id: 'line', icon: <Minus size={20} /> },
    { id: 'arrow', icon: <ArrowUpRight size={20} /> },
    { id: 'eraser', icon: <Eraser size={20} /> }
  ];

  return (
    <div className="animate-fade-in" style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      
      {/* Mobile-Friendly Bottom/Top Toolbar */}
      <div className="glass-panel mobile-bottom-bar">
        {/* Colors */}
        <div style={{ display: 'flex', gap: '0.4rem', borderRight: '1px solid var(--border-color)', paddingRight: '0.8rem' }}>
          {COLORS.map(c => (
            <button 
              key={c}
              onClick={() => { setColor(c); if(tool === 'eraser') setTool('pen'); }}
              style={{
                width: '24px', height: '24px', borderRadius: '50%', backgroundColor: c, 
                border: color === c && tool !== 'eraser' ? '2px solid var(--text-main)' : '1px solid var(--border-color)',
                cursor: 'pointer', transition: 'transform 0.1s'
              }}
            />
          ))}
        </div>
        
        {/* Tools */}
        <div style={{ display: 'flex', gap: '0.2rem', borderRight: '1px solid var(--border-color)', paddingRight: '0.8rem', paddingLeft: '0.5rem' }}>
          {tools.map(t => (
            <button
              key={t.id}
              className={`toolbar-btn ${tool === t.id ? 'active' : ''}`}
              onClick={() => setTool(t.id)}
              title={t.id}
            >
              {t.icon}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.2rem', paddingLeft: '0.5rem' }}>
          <button className="toolbar-btn" onClick={handleUndo} title="Undo"><Undo2 size={20} /></button>
          <button className="toolbar-btn" onClick={handleRedo} title="Redo"><Redo2 size={20} /></button>
          <button className="toolbar-btn" onClick={clearBoard} title="Clear Board" style={{ color: '#ef4444' }}><Trash2 size={20} /></button>
          <button className="toolbar-btn" onClick={exportPNG} title="Export PNG" style={{ color: '#10b981' }}><Download size={20} /></button>
          <button className="toolbar-btn" onClick={onLeave} title="Leave Room" style={{ color: '#ef4444' }}><LogOut size={20} /></button>
        </div>
      </div>

      {/* User Presence & Theme Toggle */}
      <div className="glass-panel presence-panel" style={{ position: 'absolute', top: '20px', right: '20px', padding: '1rem', borderRadius: '12px', zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <div style={{ fontWeight: '600' }}>Room: {roomId}</div>
          <button onClick={toggleTheme} className="toolbar-btn" style={{ padding: '0.2rem' }}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{peers.length + 1} Online</div>
        <ul style={{ listStyle: 'none', marginTop: '0.5rem', padding: 0, fontSize: '0.85rem' }}>
          <li>👤 {username} (You)</li>
          {peers.map(p => (
            <li key={p.id}>👤 {p.name}</li>
          ))}
        </ul>
      </div>

      {/* Peer Cursors */}
      {peers.map(p => {
        const cursor = peerCursors[p.id];
        if (!cursor) return null;
        return (
          <div key={p.id} style={{
            position: 'absolute',
            left: cursor.x,
            top: cursor.y,
            pointerEvents: 'none',
            zIndex: 20,
            transform: 'translate(-2px, -2px)'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-main)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 3 10 21 14 14 21 10 3 3" fill="var(--primary)"></polygon>
            </svg>
            <div style={{ 
              background: 'var(--primary)', color: 'white', fontSize: '11px', padding: '2px 6px', 
              borderRadius: '6px', position: 'absolute', top: '16px', left: '16px', whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }}>
              {p.name}
            </div>
          </div>
        );
      })}

      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={finishDrawing}
        onMouseOut={finishDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={finishDrawing}
        style={{ cursor: tool === 'eraser' ? 'cell' : 'crosshair', display: 'block', touchAction: 'none' }}
      />
    </div>
  );
}
