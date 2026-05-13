import React, { useState, useEffect } from 'react';
import API from '../services/api';

const Dashboard = () => {
  const userId = localStorage.getItem('user_id');

  const [file, setFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [versions, setVersions] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState(null);

  // Select file
  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  // Fetch user files
  const fetchFiles = async () => {
    try {
      const res = await API.get(`/files/user/${userId}`);
      setFiles(res.data.files);
    } catch (err) {
      console.log("Fetch files error:", err);
    }
  };

  // Fetch versions
  const fetchVersions = async (fileId) => {
    try {
      const res = await API.get(`/files/versions/${fileId}`);
      setVersions(res.data.versions);
      setSelectedFileId(fileId); // ✅ store file_id
    } catch (err) {
      console.log("Fetch versions error:", err);
    }
  };

  // Restore version
  const restoreVersion = async (version) => {
    try {
      const res = await API.post('/files/restore', {
        file_id: selectedFileId,
        version_number: version
      });

      alert(res.data.message);

      fetchFiles(); // refresh after restore
    } catch (err) {
      console.log(err.response?.data);
      alert(err.response?.data?.message || 'Restore failed');
    }
  };

  // Upload file
  const handleUpload = async () => {
    if (!file) {
      alert('Please select a file');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('user_id', userId);

    try {
      const res = await API.post('/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      alert(res.data.message);

      setFile(null);

      setTimeout(() => {
        fetchFiles();
      }, 500);

    } catch (err) {
      alert(err.response?.data?.message || 'Upload failed');
    }
  };

  // Load files on page load
  useEffect(() => {
  fetchFiles();
}, [fetchFiles]);

  return (
    <div className="container">
      <h2>Dashboard</h2>

      <p>User ID: <b>{userId}</b></p>

      {/* Upload */}
      <input type="file" onChange={handleFileChange} />
      <button onClick={handleUpload} style={{ marginLeft: '10px' }}>
        Upload
      </button>

      {/* Files */}
      <h3 style={{ marginTop: '20px' }}>Your Files</h3>

      {files.length === 0 ? (
        <p>No files uploaded</p>
      ) : (
        files.map((f) => (
          <div
            key={f.file_id}
            onClick={() => fetchVersions(f.file_id)}
            style={{
              background: 'rgba(255,255,255,0.2)',
              padding: '10px',
              marginTop: '10px',
              borderRadius: '10px',
              cursor: 'pointer'
            }}
          >
            📄 {f.original_name} (v{f.latest_version})
          </div>
        ))
      )}

      {/* Versions */}
      <h3 style={{ marginTop: '20px' }}>Versions</h3>

      {versions.length === 0 ? (
        <p>Click a file to see versions</p>
      ) : (
        versions.map((v) => (
          <div
            key={v.version_id}
            style={{
              background: 'rgba(255,255,255,0.2)',
              padding: '10px',
              marginTop: '10px',
              borderRadius: '10px'
            }}
          >
            Version {v.version_number}

            <button
              onClick={() => restoreVersion(v.version_number)}
              style={{ marginLeft: '10px' }}
            >
              Restore
            </button>
          </div>
        ))
      )}
    </div>
  );
};

export default Dashboard;