import React, { useState } from 'react';
import API from '../services/api';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [form, setForm] = useState({
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
      const res = await API.post('/auth/login', form);

      localStorage.setItem('user_id', res.data.user.user_id);

      alert(res.data.message);
      navigate('/dashboard');
    } catch (err) {
      alert(err.response?.data?.message || 'Error');
    }
  };

  return (
    <div className="container">
      <h2>Welcome Back</h2>

      <form onSubmit={handleSubmit} className="form-box">
        <input name="email" placeholder="Email" onChange={handleChange} />
        <input name="password" type="password" placeholder="Password" onChange={handleChange} />

        <button type="submit">Login</button>
      </form>

      <div className="link" onClick={() => navigate('/')}>
        New user? Register
      </div>
    </div>
  );
};

export default Login;