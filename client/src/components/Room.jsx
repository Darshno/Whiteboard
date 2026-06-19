import { useState } from 'react';

import { Sun, Moon } from 'lucide-react';

export default function Room({ onJoinRoom, theme, toggleTheme }) {
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (roomId.trim() && username.trim()) {
      onJoinRoom(roomId.trim(), username.trim());
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', position: 'relative' }}>
      
      {/* Theme Toggle Top Right */}
      <button onClick={toggleTheme} className="toolbar-btn glass-panel" style={{ position: 'absolute', top: '20px', right: '20px', padding: '0.5rem' }}>
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <div className="glass-panel" style={{ padding: '2.5rem', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        <h1 style={{ marginBottom: '1.5rem', fontSize: '1.8rem', fontWeight: '700' }}>Join Whiteboard</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Enter a room ID to start collaborating</p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input 
            type="text" 
            className="input-field" 
            placeholder="Your Name (e.g. Alice)" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input 
            type="text" 
            className="input-field" 
            placeholder="Room ID (e.g. design-team)" 
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            required
          />
          <button type="submit" className="btn-primary">Join Room</button>
        </form>
      </div>
    </div>
  );
}
