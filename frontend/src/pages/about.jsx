import React from 'react';
import './about.css';

function About() {
  return (
    <>
      <div className="about-container">
        <div className="about-text">
          <h1 className="about-title">About Us</h1>
          <p className="about-description">
          MORE Electric and Power Corporation (MORE Power) is a private electric
            distribution company serving Iloilo City, Philippines. The company focuses 
            on providing reliable and efficient electricity to residential, commercial, and
            industrial customers. It continues to modernize the local power grid to improve service quality and 
            reduce system losses.
          </p>
        </div>
        <div className="about-logo">
          <img 
            src="/more-power-logo.png" 
            alt="Energy News Updates Logo" 
          />
        </div>
      </div>
    </>
  );
}

export default About;
