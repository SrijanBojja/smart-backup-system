import React from 'react';

const Navbar = () => {
  return (
    <div style={{
      width: '100%',
      padding: '15px 0',
      textAlign: 'center',
      color: 'white',
      fontWeight: 'bold',
      fontSize: '20px',
      letterSpacing: '1px',
      background: 'rgba(0,0,0,0.2)',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
    }}>
       Smart Backup System
    </div>
  );
};

export default Navbar;