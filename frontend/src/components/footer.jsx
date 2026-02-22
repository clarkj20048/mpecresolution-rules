import React from 'react';
import './footer.css';

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-info">
          <p>&copy; {new Date().getFullYear()} MEPC. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
