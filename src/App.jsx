import { useState, useEffect } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:3000');

function App() {
  const [items, setItems] = useState([]);
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [mySocketId, setMySocketId] = useState(null);
  const [username, setUsername] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [tempUsername, setTempUsername] = useState('');

  useEffect(() => {
    const clientTimeBeforeFetch = Date.now();

    fetch('http://localhost:3000/items')
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
      console.log('Connected with ID:', socket.id);
    });

    socket.on('USER_REGISTERED', (data) => {
      setUsername(data.username);
      setIsRegistered(true);
      console.log('Registered as:', data.username);
    });

    socket.on('UPDATE_BID', (data) => {
      setItems(prevItems =>
        prevItems.map(item =>
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
      <div style={{
        padding: '40px',
        fontFamily: 'Arial, sans-serif',
        maxWidth: '400px',
        margin: '100px auto',
        textAlign: 'center'
      }}>
        <h1>Live Auction</h1>
        <p>Enter your name to start bidding</p>
        <form onSubmit={handleRegister}>
          <input
            type="text"
            value={tempUsername}
            onChange={(e) => setTempUsername(e.target.value)}
            style={{
              padding: '12px',
              fontSize: '16px',
              width: '100%',
              marginBottom: '10px',
              border: '2px solid #333',
              borderRadius: '4px'
            }}
            autoFocus
          />
          <button
            type="submit"
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              width: '100%',
              fontWeight: 'bold'
            }}
          >
            Join Auction
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h1>Live Auction Platform</h1>
        <div style={{
          backgroundColor: '#4CAF50',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '20px',
          fontWeight: 'bold'
        }}>
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
    <div style={{
      border: '2px solid #333',
      padding: '20px',
      marginBottom: '20px',
      borderRadius: '8px',
      backgroundColor: isExpired ? '#f0f0f0' : 'white',
      position: 'relative'
    }}>
      {amIWinning && !isExpired && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          backgroundColor: '#4CAF50',
          color: 'white',
          padding: '5px 15px',
          borderRadius: '20px',
          fontWeight: 'bold',
          fontSize: '14px'
        }}>
          WINNING
        </div>
      )}

      {someoneElseIsBidding && !isExpired && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          backgroundColor: '#f44336',
          color: 'white',
          padding: '5px 15px',
          borderRadius: '20px',
          fontWeight: 'bold',
          fontSize: '14px'
        }}>
          OUTBID
        </div>
      )}

      <h2>{item.title}</h2>

      <div style={{
        fontSize: '32px',
        fontWeight: 'bold',
        color: '#2a9d2a',
        backgroundColor: flashGreen ? '#90EE90' : 'transparent',
        padding: '5px 10px',
        borderRadius: '5px',
        display: 'inline-block'
      }}>
        ${item.currentBid}
      </div>

      {item.lastBidderName && (
        <p style={{ color: '#666', fontSize: '14px' }}>
          Last bid by {item.lastBidderName}
        </p>
      )}

      <p style={{
        fontSize: '18px',
        fontWeight: 'bold',
        color: isExpired ? '#999' : '#000'
      }}>
        {timeLeft}
      </p>

      <button
        onClick={() => onBid(item.id, item.currentBid)}
        disabled={isExpired}
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          cursor: isExpired ? 'not-allowed' : 'pointer',
          backgroundColor: isExpired ? '#ccc' : '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontWeight: 'bold'
        }}
      >
        {isExpired ? 'Auction Ended' : 'Bid +10'}
      </button>
    </div>
  );
}

export default App;

