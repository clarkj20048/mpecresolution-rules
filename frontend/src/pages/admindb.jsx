import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './admindb.css';
import { API_BASE_URL, apiUrl } from '../config/api';

function AdminDB() {
  useAuth(); // Ensures component is only accessible to authenticated users
  const [contacts, setContacts] = useState([]);
  const [resolutions, setResolutions] = useState([]);
  const [pendingResolutions, setPendingResolutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMessage, setSelectedMessage] = useState(null);

  useEffect(() => {
    fetchContacts();
    fetchResolutions();
    fetchPendingResolutions();
  }, []);

  const fetchContacts = async () => {
    try {
      const response = await fetch(apiUrl('/api/contacts'));
      const data = await response.json();
      if (response.ok) {
        setContacts(data);
      } else {
        setError(data.error || 'Failed to fetch contacts');
      }
    } catch (err) {
      setError('Error connecting to server');
      console.error('Error:', err);
    }
  };

  const fetchResolutions = async () => {
    try {
      const response = await fetch(apiUrl('/api/resolutions'));
      const data = await response.json();
      if (response.ok) {
        setResolutions(data);
      } else {
        console.error('Failed to fetch resolutions:', data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error fetching resolutions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingResolutions = async () => {
    try {
      const response = await fetch(apiUrl('/api/pending-resolutions'));
      const data = await response.json();
      if (response.ok) {
        setPendingResolutions(data);
      } else {
        console.error('Failed to fetch pending resolutions:', data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error fetching pending resolutions:', error);
    }
  };

  const deleteContact = async (id) => {
    if (!window.confirm('Are you sure you want to delete this message?')) {
      return;
    }

    try {
      const response = await fetch(apiUrl(`/api/contacts/${id}`), {
        method: 'DELETE',
      });

      if (response.ok) {
        setContacts(contacts.filter(contact => contact.id !== id));
      } else {
        alert('Failed to delete contact message');
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Error connecting to server');
    }
  };

  // Function to delete resolution
  const deleteResolution = async (id) => {
    if (!window.confirm('Are you sure you want to delete this resolution?')) {
      return;
    }

    try {
      const response = await fetch(apiUrl(`/api/resolutions/${id}`), {
        method: 'DELETE',
      });

      if (response.ok) {
        setResolutions(resolutions.filter(resolution => resolution.id !== id));
      } else {
        alert('Failed to delete resolution');
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Error connecting to server');
    }
  };

  // Accept pending resolution - transfer to resolutions
  const acceptResolution = async (id) => {
    if (!window.confirm('Are you sure you want to accept this resolution?')) {
      return;
    }

    try {
      const response = await fetch(apiUrl(`/api/pending-resolutions/${id}/accept`), {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message || 'Resolution accepted and added to resolutions!');
        setPendingResolutions(pendingResolutions.filter(resolution => resolution.id !== id));
        // Refresh resolutions list
        fetchResolutions();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to accept resolution');
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Error connecting to server');
    }
  };

  // Reject pending resolution - delete from pending
  const rejectResolution = async (id) => {
    if (!window.confirm('Are you sure you want to reject this resolution?')) {
      return;
    }

    try {
      const response = await fetch(apiUrl(`/api/pending-resolutions/${id}/reject`), {
        method: 'POST',
      });

      if (response.ok) {
        alert('Resolution rejected and removed from pending list.');
        setPendingResolutions(pendingResolutions.filter(resolution => resolution.id !== id));
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to reject resolution');
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Error connecting to server');
    }
  };

  return (
    <div className="admindb-container">
      <div className="admindb-header">
        <h1>Admin Dashboard</h1>
      </div>
      <div className="admindb-content">

        {/* Resolutions Table Section */}
        <div className="resolutions-table-container">
          <h2 className="resolutions-title">Resolutions & Rules</h2>
          {resolutions.length > 0 ? (
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
                  {resolutions.map((resolution) => {
                    return (
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
                              >
                                View
                              </a>
                            )}
                            <button 
                              className="delete-button"
                              onClick={() => deleteResolution(resolution.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
        ) : (
            <p className="no-results">No resolutions found.</p>
          )}
        </div>

        {/* Pending Resolutions Section */}
        <div className="pending-resolutions-container">
          <h2 className="pending-resolutions-title">Pending Resolutions</h2>
          {pendingResolutions.length > 0 ? (
            <div className="table-wrapper">
              <table className="pending-resolutions-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Month</th>
                    <th>Year</th>
                    <th>Date Added</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingResolutions.map((resolution) => {
                    return (
                      <tr key={resolution.id}>
                        <td>{resolution.id}</td>
                        <td className="title-cell">{resolution.title}</td>
                        <td>{resolution.month}</td>
                        <td>{resolution.year}</td>
                        <td>{new Date(resolution.created_at).toLocaleDateString()}</td>
                        <td>
                          <div className="action-buttons">
                            {resolution.file_path && (
                              <a 
                                href={`${API_BASE_URL}${resolution.file_path}`}
                                className="view-link"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                View
                              </a>
                            )}
                            <button 
                              className="accept-button"
                              onClick={() => acceptResolution(resolution.id)}
                            >
                              Accept
                            </button>
                            <button 
                              className="reject-button"
                              onClick={() => rejectResolution(resolution.id)}
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="no-results">No pending resolutions.</p>
          )}
        </div>

        <div className="contact-messages-section">
          <h2>Contact Messages</h2>
          
          {loading ? (
            <p>Loading contacts...</p>
          ) : error ? (
            <p className="error-message">{error}</p>
          ) : contacts.length === 0 ? (
            <p>No contact messages yet.</p>
          ) : (
            <table className="contacts-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Message</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr key={contact.id}>
                    <td>{contact.id}</td>
                    <td>{contact.name}</td>
                    <td>{contact.email}</td>
                    <td>
                      <button 
                        className="view-message-button"
                        onClick={() => setSelectedMessage(contact)}
                      >
                        View Message
                      </button>
                    </td>
                    <td>{new Date(contact.created_at).toLocaleDateString()}</td>
                    <td>
                      <button 
                        className="delete-button"
                        onClick={() => deleteContact(contact.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Message Modal */}
        {selectedMessage && (
          <div className="message-modal-overlay" onClick={() => setSelectedMessage(null)}>
            <div className="message-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="message-modal-header">
                <h3>Message Details</h3>
                <button 
                  className="message-modal-close"
                  onClick={() => setSelectedMessage(null)}
                >
                  &times;
                </button>
              </div>
              <div className="message-modal-body">
                <p><strong>Name:</strong> {selectedMessage.name}</p>
                <p><strong>Email:</strong> {selectedMessage.email}</p>
                <p><strong>Date:</strong> {new Date(selectedMessage.created_at).toLocaleDateString()}</p>
                <div className="message-modal-message">
                  <strong>Message:</strong>
                  <p>{selectedMessage.message}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminDB;
