import React, { useState, useRef, useEffect } from 'react';
import './home.css';

function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [filteredResolutions, setFilteredResolutions] = useState([]);
  const [allResolutions, setAllResolutions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const searchContainerRef = useRef(null);

  // Fetch resolutions from database on component mount
  useEffect(() => {
    fetchResolutions();
  }, []);

  // Fetch resolutions from API
  const fetchResolutions = async () => {
    setLoading(true);
    try {
      const response = await fetch('https://mpecresolution-ruleswebsite.onrender.com');
      
      // Check if response has content
      const text = await response.text();
      
      if (!text) {
        console.error('Empty response from server');
        return;
      }
      
      try {
        const data = JSON.parse(text);
        if (response.ok) {
          setAllResolutions(data);
          setFilteredResolutions(data);
        } else {
          console.error('Failed to fetch resolutions:', data.error || 'Unknown error');
        }
      } catch (parseError) {
        console.error('Failed to parse JSON:', parseError, 'Response text:', text);
      }
    } catch (error) {
      console.error('Error fetching resolutions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle click outside to close recent searches
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setIsSearchFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      console.log('Searching for:', searchQuery);
      
      // Filter resolutions based on search query (searches both title and tags)
      const filtered = allResolutions.filter(resolution => {
        const searchLower = searchQuery.toLowerCase();
        
        // Check if title contains search query
        const titleMatch = resolution.title.toLowerCase().includes(searchLower);
        
        // Check if any tag contains search query
        const tagsMatch = resolution.tags && resolution.tags.some(tag => 
          tag.toLowerCase().includes(searchLower)
        );
        
        return titleMatch || tagsMatch;
      });
      
      setFilteredResolutions(filtered);
      setHasSearched(true);
      
      // Add to recent searches (avoid duplicates and limit to 5)
      setRecentSearches(prev => {
        const filtered = prev.filter(s => s.toLowerCase() !== searchQuery.toLowerCase());
        return [searchQuery, ...filtered].slice(0, 5);
      });
      
      setSearchQuery('');
    } else {
      // If search is empty, show all resolutions
      setFilteredResolutions(allResolutions);
    }
  };

  const handleRecentSearchClick = (searchTerm) => {
    setSearchQuery(searchTerm);
  };

  const clearRecentSearches = (e) => {
    e.stopPropagation();
    setRecentSearches([]);
  };

  const handleSearchFocus = () => {
    setIsSearchFocused(true);
  };

  const handleSearchBlur = () => {
    // Delay hiding to allow click on recent search items
    setTimeout(() => {
      setIsSearchFocused(false);
    }, 200);
  };

  const handleShowAll = () => {
    setFilteredResolutions(allResolutions);
    setSearchQuery('');
    setHasSearched(true);
  };

  return (
    <div className="home-container">
      <div className="home-background-logo">
        <img 
          src="/more-power-logo.png" 
          alt="Background Logo" 
        />
      </div>
      <div className="home-content">
        {/* Search Section */}
        <div className="search-section">
          <div className="search-container" ref={searchContainerRef}>
            <form className="search-bar" onSubmit={handleSearch}>
              <input
                type="text"
                className="search-input"
                placeholder="Search for Resolution & Rules Files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={handleSearchFocus}
                onBlur={handleSearchBlur}
              />
              <button type="submit" className="search-button">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
              </button>
            </form>
            
            <div className={`recent-searches-container ${isSearchFocused ? 'visible' : 'hidden'}`}>
              <div className="recent-searches-header">
                <span className="recent-searches-title">Recent Searches</span>
                {recentSearches.length > 0 && (
                  <button 
                    className="clear-searches-btn"
                    onClick={clearRecentSearches}
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="recent-searches-list">
                {recentSearches.length === 0 ? (
                  <p className="no-recent-searches">No recent searches</p>
                ) : (
                  recentSearches.map((search, index) => (
                    <button
                      key={index}
                      className="recent-search-item"
                      onClick={() => handleRecentSearchClick(search)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="1"></circle>
                        <circle cx="12" cy="5" r="1"></circle>
                        <circle cx="12" cy="19" r="1"></circle>
                      </svg>
                      {search}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
          
          {(searchQuery === '' && filteredResolutions.length !== allResolutions.length) ? (
            <button className="show-all-button" onClick={handleShowAll}>
              Show All Resolutions
            </button>
          ) : null}
        </div>

        {/* Resolutions Table Section - Only visible after search */}
        <div className={`results-section ${hasSearched ? 'visible' : 'hidden'}`}>
          <div className="resolutions-table-container">
            <h2 className="resolutions-title">
              Resolutions & Rules
            </h2>
            {loading ? (
              <p className="no-results">Loading...</p>
            ) : filteredResolutions.length > 0 ? (
              <div className="table-wrapper">
                <table className="resolutions-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Title</th>
                      <th>Date Docketed</th>
                      <th>Date Published</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResolutions.map((resolution) => (
                      <tr key={resolution.id}>
                        <td>{resolution.id}</td>
                        <td className="title-cell">{resolution.title}</td>
                        <td>{resolution.date_docketed || '-'}</td>
                        <td>{resolution.date_published || '-'}</td>
                        <td>
                          <div className="action-buttons">
                            {resolution.file_path && (
                              <a 
                                href={`https://mpecresolution-ruleswebsite.onrender.com${resolution.file_path}`}
                                className="view-link"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                View
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="no-results">No resolutions found. Add some using the Add page.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
