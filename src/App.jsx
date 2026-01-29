import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const socket = io(API_URL);

function App() {
  const [items, setItems] = useState([]);
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [mySocketId, setMySocketId] = useState(null);
  const [username, setUsername] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [tempUsername, setTempUsername] = useState('');

  useEffect(() => {
    const clientTimeBeforeFetch = Date.now();

    fetch(`${API_URL}/items`)
      .then(res => res.json())
      .then(data => {
        setItems(data.items);

        const serverTime = new Date(data.serverTime).getTime();
        const clientTimeAfterFetch = Date.now();
        const networkDelay = (clientTimeAfterFetch - clientTimeBeforeFetch) / 2;
        const offset = serverTime - clientTimeAfterFetch + networkDelay;

        setServerTimeOffset(offset);
      });
  }, []);

  useEffect(() => {
    socket.on('connect', () => {
      setMySocketId(socket.id);
    });

    socket.on('USER_REGISTERED', (data) => {
      setUsername(data.username);
      setIsRegistered(true);
    });

    socket.on('UPDATE_BID', (data) => {
      setItems(prev =>
        prev.map(item =>
          item.id === data.itemId ? data.item : item
        )
      );
    });

    socket.on('BID_ERROR', (data) => {
      alert(data.error);
    });

    return () => {
      socket.off('connect');
      socket.off('USER_REGISTERED');
      socket.off('UPDATE_BID');
      socket.off('BID_ERROR');
    };
  }, []);

  const handleRegister = (e) => {
    e.preventDefault();
    if (tempUsername.trim()) {
      socket.emit('REGISTER_USER', { username: tempUsername.trim() });
    }
  };

  const placeBid = (itemId, currentBid) => {
    if (!isRegistered) {
      alert('Please enter your name first');
      return;
    }
    socket.emit('BID_PLACED', {
      itemId,
      amount: currentBid + 10
    });
  };

  if (!isRegistered) {
    return (
      <div className="register-container">
        <h1>Live Auction</h1>
        <p>Enter your name to start bidding</p>
        <form onSubmit={handleRegister}>
          <input
            type="text"
            value={tempUsername}
            onChange={(e) => setTempUsername(e.target.value)}
            autoFocus
          />
          <button type="submit">Join Auction</button>
        </form>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="header">
        <h1>Live Auction Platform</h1>
        <div className="username-badge">
          {username}
        </div>
      </div>

      <div>
        {items.map(item => (
          <AuctionItem
            key={item.id}
            item={item}
            serverTimeOffset={serverTimeOffset}
            onBid={placeBid}
            mySocketId={mySocketId}
          />
        ))}
      </div>
    </div>
  );
}

function AuctionItem({ item, serverTimeOffset, onBid, mySocketId }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isExpired, setIsExpired] = useState(false);
  const [flashGreen, setFlashGreen] = useState(false);

  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now() + serverTimeOffset;
      const endTime = new Date(item.auctionEndTime).getTime();
      const diff = endTime - now;

      if (diff <= 0) {
        setTimeLeft('ENDED');
        setIsExpired(true);
        return;
      }

      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      setIsExpired(false);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [item.auctionEndTime, serverTimeOffset]);

  useEffect(() => {
    setFlashGreen(true);
    const timeout = setTimeout(() => setFlashGreen(false), 500);
    return () => clearTimeout(timeout);
  }, [item.currentBid]);

  const amIWinning = item.lastBidder === mySocketId;
  const someoneElseIsBidding = item.lastBidder && !amIWinning;

  return (
    <div className={`auction-card ${isExpired ? 'expired' : ''}`}>
      {amIWinning && !isExpired && <div className="badge winning">WINNING</div>}
      {someoneElseIsBidding && !isExpired && <div className="badge outbid">OUTBID</div>}

      <h2>{item.title}</h2>

      <div className={`price ${flashGreen ? 'flash' : ''}`}>
        ${item.currentBid}
      </div>

      {item.lastBidderName && (
        <p className="last-bidder">
          Last bid by <strong>{item.lastBidderName}</strong>
        </p>
      )}

      <p className={`timer ${isExpired ? 'expired-text' : ''}`}>
        {timeLeft}
      </p>

      <button
        onClick={() => onBid(item.id, item.currentBid)}
        disabled={isExpired}
      >
        {isExpired ? 'Auction Ended' : 'Bid +$10'}
      </button>
    </div>
  );
}

export default App;
