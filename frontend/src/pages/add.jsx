import React, { useState } from 'react';
import './add.css';
import { apiUrl } from '../config/api';

function Add() {
  const [formData, setFormData] = useState({
    title: '',
    date_docketed: '',
    date_published: '',
    file: null
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 20 }, (_, i) => currentYear - 10 + i);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setFormData(prev => ({ ...prev, file: file }));
      setError('');
    } else {
      setFormData(prev => ({ ...prev, file: null }));
      setError('Please select a PDF file');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);

    try {
      let filePath = '';
      
      // Upload file if selected
      if (formData.file) {
        const formDataUpload = new FormData();
        formDataUpload.append('pdfFile', formData.file);

        const uploadResponse = await fetch(apiUrl('/api/upload'), {
          method: 'POST',
          body: formDataUpload,
        });

        const uploadData = await uploadResponse.json();

        if (uploadResponse.ok) {
          filePath = uploadData.filePath;
        } else {
          setError(uploadData.error || 'Failed to upload file');
          setLoading(false);
          return;
        }
      }

      // Submit resolution to pending list
      const response = await fetch(apiUrl('/api/pending-resolutions'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          date_docketed: formData.date_docketed,
          date_published: formData.date_published,
          file_path: filePath
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Resolution submitted successfully! It will be reviewed by an admin.');
        setFormData({
          title: '',
          date_docketed: '',
          date_published: '',
          file: null
        });
        // Reset file input
        document.getElementById('pdfFile').value = '';
      } else {
        setError(data.error || 'Failed to add resolution');
      }
    } catch (err) {
      setError('Error connecting to server');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="add-container">
      <div className="add-background-logo">
        <img 
          src="/more-power-logo.png" 
          alt="Background Logo" 
        />
      </div>
      <div className="add-content">
        <h1 className="add-title">Add New Resolution</h1>
        
        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}
        
        <form className="add-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="title" className="form-label">
              Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              className="form-input"
              placeholder="Enter resolution title"
              value={formData.title}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="date_docketed" className="form-label">
                Date Docketed *
              </label>
              <input
                type="text"
                id="date_docketed"
                name="date_docketed"
                className="form-input"
                placeholder="Enter Date"
                value={formData.date_docketed}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="date_published" className="form-label">
                Date Published *
              </label>
              <input
                type="text"
                id="date_published"
                name="date_published"
                className="form-input"
                placeholder="Enter Date"
                value={formData.date_published}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="pdfFile" className="form-label">
              Upload PDF File*
            </label>
            <input
              type="file"
              id="pdfFile"
              name="pdfFile"
              className="form-input file-input"
              accept="application/pdf"
              onChange={handleFileChange}
            />
          </div>

          <button type="submit" className="add-button" disabled={loading}>
            {loading ? 'Adding...' : 'Add Resolution'}
          </button>
        </form>
      </div>
    </div>

    </>
  );
}

export default Add;
