import React, { useState } from 'react';
import './add.css';

function Add() {
  const [formData, setFormData] = useState({
    title: '',
    month: '',
    year: '',
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

        const uploadResponse = await fetch('http://localhost:3001/api/upload', {
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
      const response = await fetch('http://localhost:3001/api/pending-resolutions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          month: formData.month,
          year: formData.year,
          file_path: filePath
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Resolution submitted successfully! It will be reviewed by an admin.');
        setFormData({
          title: '',
          month: '',
          year: '',
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
              <label htmlFor="month" className="form-label">
                Month *
              </label>
              <select
                id="month"
                name="month"
                className="form-input"
                value={formData.month}
                onChange={handleChange}
                required
              >
                <option value="">Select Month</option>
                {months.map(month => (
                  <option key={month} value={month}>{month}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="year" className="form-label">
                Year *
              </label>
              <select
                id="year"
                name="year"
                className="form-input"
                value={formData.year}
                onChange={handleChange}
                required
              >
                <option value="">Select Year</option>
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="pdfFile" className="form-label">
              Upload PDF File (Optional)
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
