import { useState, useEffect } from 'react';
import Room from './components/Room';
import Whiteboard from './components/Whiteboard';
import './index.css';

function App() {
  const [roomId, setRoomId] = useState(null);
  const [username, setUsername] = useState(null);
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleJoinRoom = (id, name) => {
    setRoomId(id);
    setUsername(name);
  };

  const handleLeaveRoom = () => {
    setRoomId(null);
    setUsername(null);
  };

  return (
    <div className="App" style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {!roomId ? (
        <Room onJoinRoom={handleJoinRoom} theme={theme} toggleTheme={toggleTheme} />
      ) : (
        <Whiteboard roomId={roomId} username={username} onLeave={handleLeaveRoom} theme={theme} toggleTheme={toggleTheme} />
      )}
    </div>
  );
}

export default App;
