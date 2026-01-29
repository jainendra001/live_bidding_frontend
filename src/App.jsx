import { useState, useEffect } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:3000');

function App() {
  const [items, setItems] = useState([]);
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [mySocketId, setMySocketId] = useState(null);
  
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
        console.log('Server time offset:', offset, 'ms');
      });
  }, []);
  
  useEffect(() => {
  
    socket.on('connect', () => {
      setMySocketId(socket.id);
      console.log('My socket ID:', socket.id);
    });
    
    socket.on('UPDATE_BID', (data) => {
      console.log('Bid update:', data);
      setItems(prevItems => 
        prevItems.map(item => 
          item.id === data.itemId ? data.item : item
        )
      );
    });
    
    socket.on('BID_ERROR', (data) => {
      alert('Error: ' + data.error);
    });
    
    return () => {
      socket.off('connect');
      socket.off('UPDATE_BID');
      socket.off('BID_ERROR');
    };
  }, []);
  
  const placeBid = (itemId, currentBid) => {
    const newBid = currentBid + 10;
    console.log('Placing bid:', { itemId, amount: newBid });
    socket.emit('BID_PLACED', { itemId, amount: newBid });
  };
  
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Live Auction Platform</h1>
      <p style={{ color: '#666', fontSize: '14px' }}>Your ID: {mySocketId}</p>
      
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
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
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
  
  const cardStyle = {
    border: '2px solid #333',
    padding: '20px',
    marginBottom: '20px',
    borderRadius: '8px',
    backgroundColor: isExpired ? '#f0f0f0' : 'white',
    position: 'relative',
    transition: 'background-color 0.5s ease'
  };
  
  const priceStyle = {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#2a9d2a',
    backgroundColor: flashGreen ? '#90EE90' : 'transparent',
    padding: '5px 10px',
    borderRadius: '5px',
    transition: 'background-color 0.5s ease',
    display: 'inline-block'
  };
  
  const timerStyle = {
    fontSize: '18px',
    fontWeight: 'bold',
    color: isExpired ? '#999' : '#000'
  };
  
  return (
    <div style={cardStyle}>
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
      
      <h2 style={{ marginTop: 0 }}>{item.title}</h2>
      <div style={priceStyle}>
        ${item.currentBid}
      </div>
      <p style={timerStyle}>
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
        {isExpired ? 'Auction Ended' : 'Bid +$10'}
      </button>
    </div>
  );
}

export default App;
