import React, { useState } from 'react';
import API from '../services/api';
import { useNavigate } from 'react-router-dom';

const Register = () => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: ''
  });

  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await API.post('/auth/register', form); // ✅ FIXED
      alert(res.data.message);
      navigate('/login');
    } catch (err) {
      alert(err.response?.data?.message || 'Error');
    }
  };

  return (
    <div className="container">
      <h2>Create Account</h2>

      <form onSubmit={handleSubmit} className="form-box">
        <input
          name="name"
          placeholder="Full Name"
          value={form.name}
          onChange={handleChange}
        />

        <input
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
        />

        <input
          name="password"
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
        />

        <button type="submit">Register</button>
      </form>

      <div className="link" onClick={() => navigate('/login')}>
        Already have an account? Login
      </div>
    </div>
  );
};

export default Register;