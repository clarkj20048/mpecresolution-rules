import React, { useState, useRef, useEffect } from 'react';
import './home.css';
import { API_BASE_URL, apiUrl } from '../config/api';

const RECENT_SEARCHES_KEY = 'mepc_recent_searches';
const RECENTLY_VIEWED_KEY = 'mepc_recently_viewed';

function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Error reading recent searches from storage:', error);
      return [];
    }
  });
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [recentlyViewed, setRecentlyViewed] = useState(() => {
    try {
      const saved = localStorage.getItem(RECENTLY_VIEWED_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Error reading recently viewed from storage:', error);
      return [];
    }
  });
  const [filteredResolutions, setFilteredResolutions] = useState([]);
  const [allResolutions, setAllResolutions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingRecentlyViewed, setLoadingRecentlyViewed] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const searchContainerRef = useRef(null);

  // Fetch resolutions and recently viewed data on component mount
  useEffect(() => {
    fetchResolutions();
    fetchRecentlyViewed();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recentSearches));
    } catch (error) {
      console.error('Error saving recent searches to storage:', error);
    }
  }, [recentSearches]);

  useEffect(() => {
    try {
      localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(recentlyViewed));
    } catch (error) {
      console.error('Error saving recently viewed to storage:', error);
    }
  }, [recentlyViewed]);

  // Fetch resolutions from API
  const fetchResolutions = async () => {
    setLoading(true);
    try {
      const response = await fetch(apiUrl('/api/resolutions'));
      const data = await response.json();

      if (response.ok) {
        setAllResolutions(Array.isArray(data) ? data : []);
        setFilteredResolutions(Array.isArray(data) ? data : []);
      } else {
        console.error('Failed to fetch resolutions:', data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error fetching resolutions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentlyViewed = async () => {
    setLoadingRecentlyViewed(true);
    try {
      const response = await fetch(apiUrl('/api/recently-viewed'));
      const data = await response.json();

      if (response.ok) {
        setRecentlyViewed(Array.isArray(data) ? data : []);
      } else {
        console.error('Failed to fetch recently viewed:', data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error fetching recently viewed:', error);
    } finally {
      setLoadingRecentlyViewed(false);
    }
  };

  const upsertRecentlyViewedLocally = (resolution) => {
    const entry = {
      id: resolution.id,
      title: resolution.title,
      file_path: resolution.file_path || '',
      date_docketed: resolution.date_docketed || '',
      date_published: resolution.date_published || '',
      viewed_at: new Date().toISOString()
    };

    setRecentlyViewed((prev) => {
      const existing = prev.filter((item) => item.id !== entry.id);
      return [entry, ...existing].slice(0, 10);
    });
  };

  const trackRecentlyViewed = async (resolution) => {
    // Optimistic UI update so the container reflects activity immediately.
    upsertRecentlyViewedLocally(resolution);

    try {
      const response = await fetch(apiUrl('/api/recently-viewed'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: resolution.id,
          title: resolution.title,
          file_path: resolution.file_path,
          date_docketed: resolution.date_docketed,
          date_published: resolution.date_published
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setRecentlyViewed(Array.isArray(data.recentlyViewed) ? data.recentlyViewed : []);
      } else {
        console.error('Failed to track recently viewed:', data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error tracking recently viewed:', error);
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

        <div className="results-section visible">
          <div className="recently-viewed-container">
            <h2 className="recently-viewed-title">Recently Viewed PDFs</h2>
            {loadingRecentlyViewed && recentlyViewed.length === 0 ? (
              <p className="no-results">Loading...</p>
            ) : recentlyViewed.length > 0 ? (
              <div className="table-wrapper">
                <table className="recently-viewed-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Title</th>
                      <th>Date Docketed</th>
                      <th>Date Published</th>
                      <th>Last Viewed</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentlyViewed.map((resolution) => (
                      <tr key={resolution.id}>
                        <td>{resolution.id}</td>
                        <td className="title-cell">{resolution.title}</td>
                        <td>{resolution.date_docketed || '-'}</td>
                        <td>{resolution.date_published || '-'}</td>
                        <td>{resolution.viewed_at ? new Date(resolution.viewed_at).toLocaleString() : '-'}</td>
                        <td>
                          <div className="action-buttons">
                            {resolution.file_path && (
                              <a
                                href={`${API_BASE_URL}${resolution.file_path}`}
                                className="view-link"
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => trackRecentlyViewed(resolution)}
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
              <p className="no-results">No recently viewed PDFs yet.</p>
            )}
          </div>

          <div className="resolutions-table-container">
            <h2 className="resolutions-title">
              Resolutions & Rules
            </h2>
            {!hasSearched ? (
              <p className="no-results">Search for a resolution to display results.</p>
            ) : loading ? (
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
                                href={`${API_BASE_URL}${resolution.file_path}`}
                                className="view-link"
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => trackRecentlyViewed(resolution)}
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
