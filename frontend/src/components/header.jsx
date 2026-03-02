import './header.css';

function Header() {
  return (
    <header className="header">
      <nav>
        <h1>
          <img src="/mepclogo.png" alt="MEPC Logo" className="header-logo" />
        </h1>
        <ul className="nav-links">
          <li><a href="/">Home</a></li>
          <li><a href="/about">About</a></li>
          <li><a href="/contact">Contact</a></li>
          <li><a href="/add">Add</a></li>
          <li><a href="/login">Admin Login</a></li>
        </ul>
      </nav>
    </header>
  );
}

export default Header;
