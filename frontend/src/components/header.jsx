import './header.css';
import { Link } from 'react-router-dom';

function Header() {
  return (
    <header className="header">
      <nav>
        <h1>
          <Link to="/">
            <img src="/mepclogo.png" alt="MEPC Logo" className="header-logo" />
          </Link>
        </h1>
        <ul className="nav-links">
          <li><Link to="/">Home</Link></li>
          <li><Link to="/about">About</Link></li>
          <li><Link to="/contact">Contact</Link></li>
          <li><Link to="/add">Add</Link></li>
          <li><Link to="/login">Admin Login</Link></li>
        </ul>
      </nav>
    </header>
  );
}

export default Header;
