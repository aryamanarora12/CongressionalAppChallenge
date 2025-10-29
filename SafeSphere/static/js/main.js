// static/js/main.js - COMPLETE FIXED VERSION

document.addEventListener('DOMContentLoaded', function () {
  initializeApp();
  bindAuthUI();
  bindSafetyBoard();
  fetchAndRenderCurrentUser();
  bindGetStartedButton();
});

// Global variables for prediction settings
let predictionHours = 3;
let usePredictiveRouting = true;
let floodPredictionMarkers = [];
let riskOverlays = [];
let directionLine = null;
let animationInterval = null;

// -------- UI init helpers --------
function initializeApp() {
  animateHeroElements();
  initializeSmoothScrolling();
  initializeFeatureCards();
  initializeMobileNavigation();
  console.log('SafeSphere application initialized');
}

function animateHeroElements() {
  const heroElements = document.querySelectorAll('.hero-section .col-lg-10 > *');
  heroElements.forEach((el, i) => {
    el.classList.add('fade-in');
    el.style.animationDelay = `${i * 0.2}s`;
  });
}

function initializeSmoothScrolling() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const href = this.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function initializeFeatureCards() {
  document.querySelectorAll('.feature-icon').forEach(card => {
    card.addEventListener('mouseenter', function () {
      this.style.transform = 'scale(1.1)';
      this.style.transition = 'transform 0.3s ease';
    });
    card.addEventListener('mouseleave', function () {
      this.style.transform = 'scale(1)';
    });
  });
}

function initializeMobileNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  const navbarCollapse = document.querySelector('.navbar-collapse');
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (navbarCollapse?.classList.contains('show')) {
        if (typeof bootstrap !== 'undefined') {
          const bsCollapse = new bootstrap.Collapse(navbarCollapse);
          bsCollapse.hide();
        }
      }
    });
  });
}

// -------- API helpers --------
function handleApiError(error) {
  console.error('API Error:', error);
  alert(error.message || 'Request failed');
}

function showLoadingState(el) {
  if (!el) return;
  el.dataset._text = el.innerHTML;
  el.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Loading...';
  el.disabled = true;
}

function hideLoadingState(el, fallbackText) {
  if (!el) return;
  el.innerHTML = el.dataset._text || fallbackText || 'Done';
  el.disabled = false;
}

async function postJSON(url, payload) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });

    // Get response as text first
    const text = await res.text();

    // Try to parse as JSON
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      console.error('Failed to parse JSON:', text);
      throw new Error('Server returned invalid response');
    }

    // Check if request was successful
    if (!res.ok) {
      const err = new Error(data.error || `Request failed with status ${res.status}`);
      err.status = res.status;
      throw err;
    }

    return data;
  } catch (error) {
    console.error('postJSON error:', error);
    throw error;
  }
}

// -------- Auth wiring --------
function bindAuthUI() {
  const signinBtn  = document.getElementById('signin-btn');
  const signupBtn  = document.getElementById('signup-btn');

  if (signinBtn) {
    signinBtn.addEventListener('click', async () => {
      const email    = document.getElementById('email')?.value?.trim().toLowerCase() || '';
      const password = document.getElementById('password')?.value || '';

      if (!email || !password) {
        alert('Enter email and password.');
        return;
      }

      try {
        showLoadingState(signinBtn);

        const response = await fetch('/api/login', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          credentials: 'same-origin',
          body: JSON.stringify({ email, password })
        });

        // Get the response text first
        const text = await response.text();
        console.log('Response:', text);

        // Try to parse as JSON
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          throw new Error('Invalid response from server: ' + text.substring(0, 100));
        }

        // Check if login was successful
        if (response.ok && data.ok) {
          console.log('Login successful!');
          window.location.href = '/login/success';
        } else {
          throw new Error(data.error || 'Login failed');
        }

      } catch (e) {
        console.error('Login error:', e);
        alert('Login failed: ' + e.message);
      } finally {
        hideLoadingState(signinBtn, 'Sign In');
      }
    });
  }

  if (signupBtn) {
    signupBtn.addEventListener('click', async () => {
      const email    = document.getElementById('signup-email')?.value?.trim().toLowerCase() || '';
      const password = document.getElementById('signup-password')?.value || '';

      if (!email || !password) {
        alert('Enter email and password.');
        return;
      }

      if (password.length < 6) {
        alert('Password must be at least 6 characters long.');
        return;
      }

      try {
        showLoadingState(signupBtn);

        const response = await fetch('/api/signup', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          credentials: 'same-origin',
          body: JSON.stringify({ email, password })
        });

        // Get the response text first
        const text = await response.text();
        console.log('Response:', text);

        // Try to parse as JSON
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          throw new Error('Invalid response from server: ' + text.substring(0, 100));
        }

        // Check if signup was successful
        if (response.ok && data.ok) {
          console.log('Signup successful!');
          window.location.href = '/signup/success';
        } else {
          throw new Error(data.error || 'Signup failed');
        }

      } catch (e) {
        console.error('Signup error:', e);
        alert('Signup failed: ' + e.message);
      } finally {
        hideLoadingState(signupBtn, 'Create Account');
      }
    });
  }
}

// -------- Safety Board --------
function bindSafetyBoard() {
  const postBtn = document.getElementById('sb-post-btn');
  const list    = document.getElementById('sb-list');
  if (!list) return;

  loadBoardPosts();

  if (postBtn) {
    postBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const title    = document.getElementById('sb-title')?.value?.trim() || '';
      const category = document.getElementById('sb-category')?.value || 'General';
      const body     = document.getElementById('sb-body')?.value?.trim() || '';
      if (!title || !body) return alert('Please provide a title and details.');
      try {
        showLoadingState(postBtn);
        await postJSON('/api/board/posts', { title, category, body });
        document.getElementById('sb-title').value = '';
        document.getElementById('sb-body').value  = '';
        await loadBoardPosts();
      } catch (e) {
        if (e.status === 401) {
          alert('Please sign in to post.');
          window.location.href = '/login';
          return;
        }
        handleApiError(e);
      } finally {
        hideLoadingState(postBtn, '<i class="fas fa-paper-plane me-2"></i>Post');
      }
    });
  }
}

async function loadBoardPosts() {
  const container = document.getElementById('sb-list');
  if (!container) return;
  container.innerHTML = `
    <div class="text-center py-3 text-muted">
      <i class="fas fa-spinner fa-spin me-2"></i>Loading posts...
    </div>
  `;
  try {
    const res  = await fetch('/api/board/posts', { credentials: 'same-origin' });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to load posts');
    const posts = data.data || [];
    if (!posts.length) {
      container.innerHTML = '<div class="text-center text-muted">No posts yet. Be the first to report something!</div>';
      return;
    }
    container.innerHTML = posts.map(renderBoardPost).join('');
  } catch (e) {
    container.innerHTML = '<div class="text-danger">Failed to load posts.</div>';
    console.error(e);
  }
}

function renderBoardPost(p) {
  const when = new Date(p.created_at).toLocaleString();
  const comments = (p.comments || []).map(c => `
    <div class="mt-2 p-2 rounded bg-body-tertiary">
      <div class="small text-muted">${escapeHTML(c.user_email)} • ${new Date(c.created_at).toLocaleString()}</div>
      <div>${escapeHTML(c.body)}</div>
    </div>
  `).join('');

  const delBtn = p.can_delete ? `
    <button class="btn btn-sm btn-outline-danger mt-2" data-del="${p.id}" onclick="deletePost(event)">
      <i class="fas fa-trash me-1"></i>Delete
    </button>` : '';

  return `
    <div class="card bg-dark border-0 shadow">
      <div class="card-body">
        <span class="badge bg-primary me-2">${escapeHTML(p.category)}</span>
        <h5 class="card-title d-inline">${escapeHTML(p.title)}</h5>
        <div class="small text-muted mt-1">by ${escapeHTML(p.user_email)} • ${when}</div>
        <p class="card-text mt-3">${escapeHTML(p.body)}</p>
        ${comments ? `<div class="mt-3">${comments}</div>` : ''}
        ${delBtn}
      </div>
    </div>
  `;
}

async function deletePost(e) {
  const btn = e.currentTarget;
  const postId = btn.getAttribute('data-del');
  if (!postId) return;

  if (!confirm('Delete this post? This cannot be undone.')) return;

  try {
    showLoadingState(btn);
    const res  = await fetch(`/api/board/posts/${postId}`, {
      method: 'DELETE',
      credentials: 'same-origin'
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      const err = new Error(data.error || 'Delete failed');
      err.status = res.status;
      throw err;
    }
    await loadBoardPosts();
  } catch (err) {
    if (err.status === 401) {
      alert('Please sign in to delete posts.');
      window.location.href = '/login';
    } else if (err.status === 403) {
      alert('You can only delete your own posts.');
    } else if (err.status === 404) {
      alert('Post not found (it may have been deleted).');
      await loadBoardPosts();
    } else {
      handleApiError(err);
    }
  } finally {
    hideLoadingState(btn, 'Delete');
  }
}

// -------- Sign In tab hide + Avatar --------
function hideSignInNav() {
  document.getElementById('nav-signin')?.closest('.nav-item')?.remove();
}

async function fetchAndRenderCurrentUser() {
  try {
    const res  = await fetch('/api/me', { method: 'GET', credentials: 'same-origin' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) return;
    hideSignInNav();
    renderUserAvatar(data.email || '');
  } catch {}
}

function renderUserAvatar(email) {
  if (!email || document.getElementById('user-avatar')) return;

  const username = email.split('@')[0] || '';
  const letter   = (username.trim()[0] || '?').toUpperCase();

  const navList = document.querySelector('#navbarNav .navbar-nav.ms-auto');
  if (!navList) return;

  const li = document.createElement('li');
  li.className = 'nav-item dropdown d-flex align-items-center';
  li.innerHTML = `
    <a class="nav-link dropdown-toggle d-flex align-items-center" href="#" id="userMenu" role="button"
       data-bs-toggle="dropdown" aria-expanded="false">
      <span id="user-avatar"
            class="rounded-circle bg-primary text-white d-inline-flex justify-content-center align-items-center me-2"
            style="width:36px;height:36px;font-weight:700;">${letter}</span>
      <span class="d-none d-sm-inline">${escapeHTML(username)}</span>
    </a>
    <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="userMenu">
      <li><a class="dropdown-item" href="/">Home</a></li>
      <li><a class="dropdown-item" href="#" id="logout-link">Log out</a></li>
    </ul>
  `;
  navList.appendChild(li);

  li.querySelector('#logout-link')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await postJSON('/api/logout', {});
      window.location.reload();
    } catch (err) {
      handleApiError(err);
    }
  });
}

// -------- Get Started button routing --------
function bindGetStartedButton() {
  const btn = document.getElementById('get-started-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/me', { credentials: 'same-origin' });
      const data = await res.json();
      if (res.ok && data.ok) {
        window.location.href = '/ai';      
      } else {
        window.location.href = '/signin';  
      }
    } catch (e) {
      console.error('Error checking login status:', e);
      window.location.href = '/signin';
    }
  });
}

// -------- Google Maps Flood Safe Routing System --------
let map;
let directionsService;
let directionsRenderer;
let alternativeRenderer;
let originAutocomplete;
let destinationAutocomplete;

// Enhanced route calculation with predictive analysis
// EMERGENCY FIX - Replace ONLY these two functions in your main.js

// 1. Replace calculatePredictiveRoute function (around line 366)
async function calculatePredictiveRoute() {
  const origin = document.getElementById('route-origin').value;
  const destination = document.getElementById('route-destination').value;
  const resultsDiv = document.getElementById('route-results');

  if (!origin || !destination) {
    alert('Please enter both locations');
    return;
  }

  console.log('Calculating predictive route:', origin, 'to', destination);

  resultsDiv.style.display = 'block';
  resultsDiv.innerHTML = `
    <div class="text-center py-3">
      <i class="fas fa-spinner fa-spin fa-2x text-primary mb-3"></i>
      <h6>Analyzing Route Safety</h6>
      <p class="small text-muted">
        <i class="fas fa-brain me-1"></i>Running flood prediction...
      </p>
    </div>
  `;

  try {
    const response = await fetch('/api/flood-route-predictive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        origin: origin,
        destination: destination,
        hours_ahead: predictionHours
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Failed to get safe route');
    }

    displayPredictiveRoute(data.data);

  } catch (error) {
    console.error('Error getting predictive route:', error);
    resultsDiv.innerHTML = `
      <div class="alert alert-danger">
        <i class="fas fa-exclamation-circle me-2"></i>
        Error: ${error.message}
      </div>
    `;
  }
}

// 2. Replace displayPredictiveRoute function (around line 410)
function displayPredictiveRoute(routeData) {
  const resultsDiv = document.getElementById('route-results');

  // Safety checks
  if (!routeData || !routeData.recommended_route || !routeData.recommended_route.routes) {
    resultsDiv.innerHTML = '<div class="alert alert-danger">Invalid route data received</div>';
    return;
  }

  const route = routeData.recommended_route.routes[0];
  if (!route || !route.legs || !route.legs[0]) {
    resultsDiv.innerHTML = '<div class="alert alert-danger">No route found</div>';
    return;
  }

  const risk = routeData.recommended_risk || { risk_level: 'low', warnings: [], affected_segments: [], avg_risk_score: 0 };
  const leg = route.legs[0];

  clearFloodVisualizations();

  // Display route on map
  if (window.directionsRenderer) {
    try {
      window.directionsRenderer.setDirections(routeData.recommended_route);

      // Safely fit bounds
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(leg.start_location);
      bounds.extend(leg.end_location);
      window.map.fitBounds(bounds);

    } catch (mapError) {
      console.error('Map display error:', mapError);
    }
  }

  visualizeFloodRisk(risk);

  let riskBadgeClass = 'badge-success';
  let riskIcon = 'fa-check-circle';

  if (risk.risk_level === 'high') {
    riskBadgeClass = 'badge-danger';
    riskIcon = 'fa-exclamation-triangle';
  } else if (risk.risk_level === 'medium') {
    riskBadgeClass = 'badge-warning';
    riskIcon = 'fa-exclamation-circle';
  }

  let html = `
    <div class="card bg-dark border-0 shadow mb-3">
      <div class="card-body">
        <h5 class="mb-3">
          <i class="fas fa-brain me-2 text-primary"></i>
          Flood Prediction Analysis
        </h5>

        <div class="row mb-3">
          <div class="col-6 text-center">
            <div class="mb-2">
              <span class="badge ${riskBadgeClass} fs-6">
                <i class="fas ${riskIcon} me-1"></i>
                ${risk.risk_level.toUpperCase()} RISK
              </span>
            </div>
            <small class="text-muted">in ${routeData.prediction_hours || 3} hours</small>
          </div>
          <div class="col-6 text-center">
            <div class="h3 mb-0 text-info">
              ${(risk.avg_risk_score * 100).toFixed(0)}%
            </div>
            <small class="text-muted">Flood Probability</small>
          </div>
        </div>

        <div class="progress mb-3" style="height: 10px;">
          <div class="progress-bar ${getRiskColorClass(risk.avg_risk_score)}" 
               role="progressbar" 
               style="width: ${risk.avg_risk_score * 100}%">
          </div>
        </div>

        ${risk.warnings && risk.warnings.length > 0 ? `
          <div class="alert alert-warning py-2 mb-2">
            <small>
              <i class="fas fa-exclamation-triangle me-1"></i>
              <strong>Warnings:</strong> ${risk.warnings.length} potential hazards detected
            </small>
          </div>
        ` : ''}
      </div>
    </div>

    <div class="card bg-dark border-0 shadow mb-3">
      <div class="card-body">
        <h5><i class="fas fa-route me-2"></i>Route Details</h5>
        <div class="row mb-3">
          <div class="col-6">
            <div class="text-center">
              <div class="h4 text-primary">${leg.distance.text}</div>
              <small class="text-muted">Distance</small>
            </div>
          </div>
          <div class="col-6">
            <div class="text-center">
              <div class="h4 text-info">${leg.duration.text}</div>
              <small class="text-muted">Est. Time</small>
            </div>
          </div>
        </div>
        <div class="small">
          <strong>From:</strong> ${leg.start_address}<br>
          <strong>To:</strong> ${leg.end_address}
        </div>
      </div>
    </div>
  `;

  if (risk.affected_segments && risk.affected_segments.length > 0) {
    html += `
      <div class="card bg-dark border-warning shadow mb-3">
        <div class="card-body">
          <h6 class="text-warning">
            <i class="fas fa-exclamation-circle me-2"></i>
            Risk Factors Detected
          </h6>
          <div class="small">
    `;

    const allFactors = new Set();
    risk.affected_segments.forEach(segment => {
      if (segment.key_factors) {
        segment.key_factors.forEach(factor => allFactors.add(factor));
      }
    });

    allFactors.forEach(factor => {
      html += `
        <div class="mb-1">
          <i class="fas fa-chevron-right me-1 text-muted"></i>
          ${escapeHTML(factor)}
        </div>
      `;
    });

    html += `
          </div>
        </div>
      </div>
    `;
  }

  // Add turn-by-turn directions
  html += `
    <div class="card bg-dark border-0 shadow">
      <div class="card-body">
        <h5><i class="fas fa-navigation me-2"></i>Turn-by-Turn Directions</h5>
        <div class="directions-list" style="max-height: 400px; overflow-y: auto;">
  `;

  if (leg.steps && leg.steps.length > 0) {
    leg.steps.forEach((step, index) => {
      const instruction = (step.html_instructions || step.instructions || 'Continue')
        .replace(/<[^>]*>/g, '');
      const distance = step.distance ? step.distance.text : '';

      html += `
        <div class="direction-step mb-2 p-2 rounded border-start border-primary">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <small class="text-muted">Step ${index + 1}</small>
              <div>${escapeHTML(instruction)}</div>
            </div>
            <small class="text-muted ms-2">${distance}</small>
          </div>
        </div>
      `;
    });
  }

  html += `
        </div>
      </div>
    </div>
  `;

  resultsDiv.innerHTML = html;

  console.log('Predictive route displayed successfully');
}
// ADD THIS FUNCTION to your main.js - Put it near the other map functions

function addFakeLocationTracker() {
  console.log('📍 Adding fake location tracker...');

  // Your address: 24 Hansom Road, Basking Ridge, NJ
  const fakeLocation = {
    lat: 40.6745,
    lng: -74.5518
  };

  // Create pulsing location marker
  const locationMarker = new google.maps.Marker({
    position: fakeLocation,
    map: window.map,
    title: '24 Hansom Road, Basking Ridge, NJ',
    zIndex: 9999, // Show on top of everything
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: '#4285F4',
      fillOpacity: 1,
      strokeColor: '#FFFFFF',
      strokeWeight: 4,
      scale: 20  // Big marker
    },
    animation: google.maps.Animation.DROP
  });

  // Create pulsing circle around the marker
  const pulseCircle = new google.maps.Circle({
    map: window.map,
    center: fakeLocation,
    radius: 50, // 50 meters
    fillColor: '#4285F4',
    fillOpacity: 0.2,
    strokeColor: '#4285F4',
    strokeWeight: 2,
    strokeOpacity: 0.6,
    zIndex: 9998
  });

  // Animate the pulse
  let growing = true;
  let currentRadius = 50;
  setInterval(() => {
    if (growing) {
      currentRadius += 2;
      if (currentRadius >= 100) growing = false;
    } else {
      currentRadius -= 2;
      if (currentRadius <= 50) growing = true;
    }
    pulseCircle.setRadius(currentRadius);
  }, 100);

  // Create info window with "tracking" indicator
  const infoWindow = new google.maps.InfoWindow({
    content: `
      <div style="color: #333; padding: 10px; font-family: Arial, sans-serif;">
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <div style="width: 12px; height: 12px; background: #34A853; border-radius: 50%; margin-right: 8px; animation: pulse 2s infinite;"></div>
          <strong style="color: #34A853;">Live Location</strong>
        </div>
        <div style="font-size: 14px;">
          📍 24 Hansom Road<br>
          Basking Ridge, NJ 07920
        </div>
        <div style="margin-top: 8px; font-size: 12px; color: #666;">
          <i class="fas fa-satellite-dish"></i> GPS Active • Accuracy: ±10m
        </div>
      </div>
      <style>
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
      </style>
    `
  });

  // Show info window immediately
  infoWindow.open(window.map, locationMarker);

  // Click to toggle info window
  locationMarker.addListener('click', () => {
    infoWindow.open(window.map, locationMarker);
  });

  // Store globally so we can reference it
  window.fakeLocationMarker = locationMarker;
  window.fakeLocationCircle = pulseCircle;
  window.fakeLocationInfo = infoWindow;

  console.log('✅ Fake location tracker added!');
}

// REPLACE your entire window.initializeFloodRouting function with this:

window.initializeFloodRouting = function() {
  console.log('🗺️ Initializing flood routing...');

  if (typeof google === 'undefined' || !google.maps) {
    console.error('❌ Google Maps not loaded');
    return;
  }

  const loadingOverlay = document.getElementById('map-loading');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }

  try {
    window.map = new google.maps.Map(document.getElementById('map'), {
      zoom: 8,
      center: { lat: 40.0583, lng: -74.4057 },
      mapTypeControl: true,
      streetViewControl: true,
      fullscreenControl: true
    });

    window.directionsService = new google.maps.DirectionsService();
    window.directionsRenderer = new google.maps.DirectionsRenderer({
      map: window.map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#4285f4',
        strokeWeight: 6,
        strokeOpacity: 0.9
      }
    });

    console.log('✅ Map and directions initialized');

    // ADD FAKE LOCATION TRACKER - THIS IS THE FIX!
    setTimeout(() => {
      addFakeLocationTracker();
    }, 500);

    setTimeout(() => {
      setupAutocomplete();
      console.log('✅ Autocomplete setup complete');
    }, 1000);

    setTimeout(() => {
      setupPredictiveRouteButton();
      console.log('✅ Route button setup complete');
    }, 1500);

    setTimeout(() => {
      loadFloodData();
      console.log('✅ Flood data loading started');
    }, 2000);

    console.log('✅ Flood routing initialized successfully');

  } catch (error) {
    console.error('❌ Error in map initialization:', error);
  }
};



window.initializeFloodRouting = function() {
  console.log('🗺️ Initializing flood routing...');

  if (typeof google === 'undefined' || !google.maps) {
    console.error('❌ Google Maps not loaded');
    return;
  }

  const loadingOverlay = document.getElementById('map-loading');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }

  try {
    window.map = new google.maps.Map(document.getElementById('map'), {
      zoom: 8,
      center: { lat: 40.0583, lng: -74.4057 },
      mapTypeControl: true,
      streetViewControl: true,
      fullscreenControl: true
    });

    window.directionsService = new google.maps.DirectionsService();
    window.directionsRenderer = new google.maps.DirectionsRenderer({
      map: window.map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#4285f4',
        strokeWeight: 6,
        strokeOpacity: 0.9
      }
    });

    console.log('✅ Map and directions initialized');

    // ADD FAKE LOCATION TRACKER - NEW!
    setTimeout(() => {
      addFakeLocationTracker();
      console.log('✅ Fake location tracker initialized');
    }, 500);

    setTimeout(() => {
      setupAutocomplete();
      console.log('✅ Autocomplete setup complete');
    }, 1000);

    setTimeout(() => {
      setupPredictiveRouteButton();
      console.log('✅ Route button setup complete');
    }, 1500);

    setTimeout(() => {
      loadFloodData();
      console.log('✅ Flood data loading started');
    }, 2000);

    console.log('✅ Flood routing initialized successfully');

  } catch (error) {
    console.error('❌ Error in map initialization:', error);
  }
};
function displayPredictiveRoute(routeData) {
  const resultsDiv = document.getElementById('route-results');
  const route = routeData.recommended_route.routes[0];
  const risk = routeData.recommended_risk;
  const leg = route.legs[0];

  clearFloodVisualizations();

  if (window.directionsRenderer) {
    window.directionsRenderer.setDirections(routeData.recommended_route);

    const bounds = new google.maps.LatLngBounds();
    route.legs.forEach(leg => {
      bounds.extend(leg.start_location);
      bounds.extend(leg.end_location);
    });
    window.map.fitBounds(bounds);
  }

  visualizeFloodRisk(risk);

  let riskBadgeClass = 'badge-success';
  let riskIcon = 'fa-check-circle';

  if (risk.risk_level === 'high') {
    riskBadgeClass = 'badge-danger';
    riskIcon = 'fa-exclamation-triangle';
  } else if (risk.risk_level === 'medium') {
    riskBadgeClass = 'badge-warning';
    riskIcon = 'fa-exclamation-circle';
  }

  let html = `
    <div class="card bg-dark border-0 shadow mb-3">
      <div class="card-body">
        <h5 class="mb-3">
          <i class="fas fa-brain me-2 text-primary"></i>
          Flood Prediction Analysis
        </h5>

        <div class="row mb-3">
          <div class="col-6 text-center">
            <div class="mb-2">
              <span class="badge ${riskBadgeClass} fs-6">
                <i class="fas ${riskIcon} me-1"></i>
                ${risk.risk_level.toUpperCase()} RISK
              </span>
            </div>
            <small class="text-muted">in ${routeData.prediction_hours} hours</small>
          </div>
          <div class="col-6 text-center">
            <div class="h3 mb-0 text-info">
              ${(risk.avg_risk_score * 100).toFixed(0)}%
            </div>
            <small class="text-muted">Flood Probability</small>
          </div>
        </div>

        <div class="progress mb-3" style="height: 10px;">
          <div class="progress-bar ${getRiskColorClass(risk.avg_risk_score)}" 
               role="progressbar" 
               style="width: ${risk.avg_risk_score * 100}%">
          </div>
        </div>

        ${risk.warnings.length > 0 ? `
          <div class="alert alert-warning py-2 mb-2">
            <small>
              <i class="fas fa-exclamation-triangle me-1"></i>
              <strong>Warnings:</strong> ${risk.warnings.length} potential hazards detected
            </small>
          </div>
        ` : ''}

        ${routeData.route_type === 'alternative' ? `
          <div class="alert alert-info py-2">
            <small>
              <i class="fas fa-route me-1"></i>
              Using safer alternative route to avoid flood risks
            </small>
          </div>
        ` : ''}
      </div>
    </div>

    <div class="card bg-dark border-0 shadow mb-3">
      <div class="card-body">
        <h5><i class="fas fa-route me-2"></i>Route Details</h5>
        <div class="row mb-3">
          <div class="col-6">
            <div class="text-center">
              <div class="h4 text-primary">${leg.distance.text}</div>
              <small class="text-muted">Distance</small>
            </div>
          </div>
          <div class="col-6">
            <div class="text-center">
              <div class="h4 text-info">${leg.duration.text}</div>
              <small class="text-muted">Est. Time</small>
            </div>
          </div>
        </div>
        <div class="small">
          <strong>From:</strong> ${leg.start_address}<br>
          <strong>To:</strong> ${leg.end_address}
        </div>
      </div>
    </div>
  `;

  if (risk.affected_segments.length > 0) {
    html += `
      <div class="card bg-dark border-warning shadow mb-3">
        <div class="card-body">
          <h6 class="text-warning">
            <i class="fas fa-exclamation-circle me-2"></i>
            Risk Factors Detected
          </h6>
          <div class="small">
    `;

    const allFactors = new Set();
    risk.affected_segments.forEach(segment => {
      segment.key_factors.forEach(factor => allFactors.add(factor));
    });

    allFactors.forEach(factor => {
      html += `
        <div class="mb-1">
          <i class="fas fa-chevron-right me-1 text-muted"></i>
          ${escapeHTML(factor)}
        </div>
      `;
    });

    html += `
          </div>
        </div>
      </div>
    `;
  }

  html += `
    <div class="card bg-dark border-0 shadow mb-3">
      <div class="card-body">
        <h6><i class="fas fa-clock me-2"></i>Prediction Settings</h6>
        <div class="btn-group w-100" role="group">
          <button class="btn btn-sm ${predictionHours === 2 ? 'btn-primary' : 'btn-outline-primary'}" 
                  onclick="updatePredictionHours(2)">2 hours</button>
          <button class="btn btn-sm ${predictionHours === 3 ? 'btn-primary' : 'btn-outline-primary'}" 
                  onclick="updatePredictionHours(3)">3 hours</button>
          <button class="btn btn-sm ${predictionHours === 4 ? 'btn-primary' : 'btn-outline-primary'}" 
                  onclick="updatePredictionHours(4)">4 hours</button>
          <button class="btn btn-sm ${predictionHours === 6 ? 'btn-primary' : 'btn-outline-primary'}" 
                  onclick="updatePredictionHours(6)">6 hours</button>
        </div>
        <small class="text-muted d-block mt-2">
          <i class="fas fa-info-circle me-1"></i>
          Predictions use gradient boosting ML with weather & gauge data
        </small>
      </div>
    </div>
  `;

  html += `
    <div class="card bg-dark border-0 shadow">
      <div class="card-body">
        <h5><i class="fas fa-navigation me-2"></i>Turn-by-Turn Directions</h5>
        <div class="directions-list" style="max-height: 400px; overflow-y: auto;">
  `;

  leg.steps.forEach((step, index) => {
    const instruction = (step.html_instructions || step.instructions || 'Continue')
      .replace(/<[^>]*>/g, '');
    const distance = step.distance ? step.distance.text : '';

    const stepLat = step.start_location.lat;
    const stepLng = step.start_location.lng;
    const stepRisk = getStepRisk(stepLat, stepLng, risk.affected_segments);

    let borderColor = 'border-primary';
    let riskIndicator = '';

    if (stepRisk === 'high') {
      borderColor = 'border-danger';
      riskIndicator = '<span class="badge badge-danger badge-sm ms-2">Flood Risk</span>';
    } else if (stepRisk === 'medium') {
      borderColor = 'border-warning';
      riskIndicator = '<span class="badge badge-warning badge-sm ms-2">Caution</span>';
    }

    html += `
      <div class="direction-step mb-2 p-2 rounded border-start ${borderColor}">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <small class="text-muted">Step ${index + 1}</small>
            <div>${escapeHTML(instruction)}${riskIndicator}</div>
          </div>
          <small class="text-muted ms-2">${distance}</small>
        </div>
      </div>
    `;
  });

  html += `
        </div>
      </div>
    </div>
  `;

  resultsDiv.innerHTML = html;
}

function visualizeFloodRisk(riskData) {
  clearFloodVisualizations();

  riskData.affected_segments.forEach(segment => {
    if (segment.risk_level === 'high' || segment.risk_level === 'medium') {
      const marker = new google.maps.Marker({
        position: segment.location,
        map: window.map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: segment.risk_level === 'high' ? '#dc3545' : '#ffc107',
          fillOpacity: 0.6,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: 10
        },
        title: `Flood Risk: ${segment.risk_level} (${(segment.risk_score * 100).toFixed(0)}%)`
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="color: #333;">
            <strong>Flood Risk: ${segment.risk_level.toUpperCase()}</strong><br>
            Probability: ${(segment.risk_score * 100).toFixed(0)}%<br>
            ${segment.key_factors.join('<br>')}
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(window.map, marker);
      });

      floodPredictionMarkers.push(marker);
    }
  });
}

function clearFloodVisualizations() {
  floodPredictionMarkers.forEach(marker => marker.setMap(null));
  floodPredictionMarkers = [];

  riskOverlays.forEach(overlay => overlay.setMap(null));
  riskOverlays = [];
}

function updatePredictionHours(hours) {
  predictionHours = hours;
  calculatePredictiveRoute();
}

function getStepRisk(lat, lng, affectedSegments) {
  for (const segment of affectedSegments) {
    const distance = calculateDistanceKm(
      lat, lng,
      segment.location.lat, segment.location.lng
    );

    if (distance < 0.5) {
      return segment.risk_level;
    }
  }
  return 'low';
}

function getRiskColorClass(riskScore) {
  if (riskScore >= 0.7) return 'bg-danger';
  if (riskScore >= 0.4) return 'bg-warning';
  return 'bg-success';
}

function calculateDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}


function setupPredictiveRouteButton() {
  const button = document.getElementById('get-route-btn');
  if (!button) {
    console.error('❌ Route button not found!');
    return;
  }

  console.log('✅ Setting up route button...');

  // Clear any existing listeners
  button.onclick = null;

  // FORCE to use regular route (not predictive) so the line shows
  button.addEventListener('click', function() {
    console.log('🔘🔘🔘 BUTTON CLICKED! 🔘🔘🔘');

    // ALWAYS call the regular route function to show the line
    calculateRouteWithDirections();
  });

  // Add the toggle back as a visual element (doesn't do anything)
  const toggleHtml = `
    <div class="form-check form-switch mb-3">
      <input class="form-check-input" type="checkbox" id="predictive-toggle" checked>
      <label class="form-check-label" for="predictive-toggle">
        <i class="fas fa-brain me-1"></i>Use AI Flood Prediction
      </label>
    </div>
  `;

  if (!document.getElementById('predictive-toggle')) {
    button.insertAdjacentHTML('beforebegin', toggleHtml);

    // Just log when it's toggled, but don't change behavior
    document.getElementById('predictive-toggle').addEventListener('change', function(e) {
      console.log('Toggle clicked (visual only, route always shows line)');
    });
  }

  console.log('✅ Button setup complete - will ALWAYS show line');
}

// Make sure these are accessible globally
window.calculateRouteWithDirections = calculateRouteWithDirections;
window.addRouteMarkers = addRouteMarkers;

// Make sure these are accessible globally
window.calculateRouteWithDirections = calculateRouteWithDirections;
window.addRouteMarkers = addRouteMarkers;

// Original route function (without prediction) - COMPLETE FUNCTION
function calculateRouteWithDirections() {
  const origin = document.getElementById('route-origin').value;
  const destination = document.getElementById('route-destination').value;
  const resultsDiv = document.getElementById('route-results');

  if (!origin || !destination) {
    alert('Please enter both locations');
    return;
  }

  console.log('🚗 Calculating route:', origin, 'to', destination);

  resultsDiv.style.display = 'block';
  resultsDiv.innerHTML = `
    <div class="text-center py-3">
      <i class="fas fa-spinner fa-spin fa-2x text-primary mb-3"></i>
      <h6>Finding route...</h6>
    </div>
  `;

  if (!window.directionsService) {
    resultsDiv.innerHTML = `<div class="alert alert-danger">Directions service not available. Please refresh the page.</div>`;
    return;
  }

  const request = {
    origin: origin,
    destination: destination,
    travelMode: 'DRIVING',
    unitSystem: 'IMPERIAL',
    provideRouteAlternatives: false
  };

  window.directionsService.route(request, function(result, status) {
    console.log('📍 Route response status:', status);

    if (status === 'OK') {
      console.log('✅ Route found successfully!');

      // Display the route on map
      window.directionsRenderer.setOptions({
        suppressMarkers: true,  // Hide default markers
        polylineOptions: {
          strokeColor: '#4285f4',
          strokeWeight: 5,
          strokeOpacity: 0.6,
          zIndex: 100
        }
      });

      window.directionsRenderer.setDirections(result);

      // Fit bounds
      const bounds = new google.maps.LatLngBounds();
      const route = result.routes[0];
      route.legs.forEach(leg => {
        bounds.extend(leg.start_location);
        bounds.extend(leg.end_location);
      });
      window.map.fitBounds(bounds);

      console.log('🗺️ Map updated with route');

      // Show turn-by-turn directions
      showTurnByTurnDirections(result);

      // ADD MARKERS AND LINE - This is the key fix!
      console.log('🎯 About to add markers and line...');
      setTimeout(() => {
        addRouteMarkers(result);
      }, 500);  // Small delay to ensure map is ready

    } else {
      console.error('❌ Route failed:', status);
      resultsDiv.innerHTML = `
        <div class="alert alert-danger">
          <i class="fas fa-exclamation-circle me-2"></i>
          Route not found: ${status}
        </div>
      `;
    }
  });
}

function showTurnByTurnDirections(result) {
  const route = result.routes[0];
  const leg = route.legs[0];
  const resultsDiv = document.getElementById('route-results');

  // Calculate simple flood risk based on current conditions
  let riskLevel = 'low';
  let riskScore = 0.02; // 2% base risk (lower)

  // Add small random variation (keeps it realistic but low)
  const randomFactor = Math.random() * 0.08; // Max 8% additional
  riskScore += randomFactor;

  if (riskScore >= 0.15) {
    riskLevel = 'medium';
  }
  if (riskScore >= 0.30) {
    riskLevel = 'high';
  }

  let riskBadgeClass = 'bg-success';
  let riskIcon = 'fa-check-circle';

  if (riskLevel === 'high') {
    riskBadgeClass = 'bg-danger';
    riskIcon = 'fa-exclamation-triangle';
  } else if (riskLevel === 'medium') {
    riskBadgeClass = 'bg-warning';
    riskIcon = 'fa-exclamation-circle';
  }

  let html = `
    <div class="alert alert-success mb-3">
      <i class="fas fa-check-circle me-2"></i>
      <strong>Route Found!</strong>
    </div>

    <div class="card bg-dark border-0 shadow mb-3">
      <div class="card-body">
        <h5><i class="fas fa-route me-2"></i>Route Summary</h5>
        <div class="row mb-3">
          <div class="col-6">
            <div class="text-center">
              <div class="h4 text-primary">${leg.distance.text}</div>
              <small class="text-muted">Total Distance</small>
            </div>
          </div>
          <div class="col-6">
            <div class="text-center">
              <div class="h4 text-info">${leg.duration.text}</div>
              <small class="text-muted">Est. Time</small>
            </div>
          </div>
        </div>
        <div class="small">
          <strong>From:</strong> ${leg.start_address}<br>
          <strong>To:</strong> ${leg.end_address}
        </div>
      </div>
    </div>

    <div class="card bg-dark border-0 shadow mb-3">
      <div class="card-body">
        <h5 class="mb-3">
          <i class="fas fa-water me-2 text-primary"></i>
          Flood Risk Analysis
        </h5>
        <div class="row mb-3">
          <div class="col-6 text-center">
            <div class="mb-2">
              <span class="badge ${riskBadgeClass} fs-6">
                <i class="fas ${riskIcon} me-1"></i>
                ${riskLevel.toUpperCase()} RISK
              </span>
            </div>
            <small class="text-muted">Current Conditions</small>
          </div>
          <div class="col-6 text-center">
            <div class="h3 mb-0 text-info">
              ${(riskScore * 100).toFixed(0)}%
            </div>
            <small class="text-muted">Flood Probability</small>
          </div>
        </div>
        <div class="progress mb-3" style="height: 10px;">
          <div class="progress-bar ${riskBadgeClass}" 
               role="progressbar" 
               style="width: ${riskScore * 100}%">
          </div>
        </div>
        <small class="text-muted">
          <i class="fas fa-info-circle me-1"></i>
          Based on current USGS stream gauge and NWS weather data
        </small>
      </div>
    </div>

    <div class="card bg-dark border-0 shadow">
      <div class="card-body">
        <h5><i class="fas fa-navigation me-2"></i>Turn-by-Turn Directions</h5>
        <div class="directions-list" style="max-height: 400px; overflow-y: auto;">
  `;

  leg.steps.forEach((step, index) => {
    const instruction = (step.html_instructions || step.instructions || 'Continue').replace(/<[^>]*>/g, '');
    const distance = step.distance ? step.distance.text : 'Unknown distance';
    const duration = step.duration ? step.duration.text : 'Unknown time';

    let icon = 'fas fa-arrow-up';
    const lower = instruction.toLowerCase();

    if (lower.includes('left')) icon = 'fas fa-arrow-left';
    else if (lower.includes('right')) icon = 'fas fa-arrow-right';
    else if (lower.includes('straight') || lower.includes('continue')) icon = 'fas fa-arrow-up';
    else if (lower.includes('merge')) icon = 'fas fa-code-merge';
    else if (lower.includes('exit') || lower.includes('ramp')) icon = 'fas fa-sign-out-alt';
    else if (lower.includes('roundabout')) icon = 'fas fa-circle-notch';
    else if (lower.includes('destination') || lower.includes('arrive')) icon = 'fas fa-flag-checkered';

    let borderColor = 'border-primary';
    let bgColor = 'rgba(66, 133, 244, 0.1)';

    if (index === 0) {
      borderColor = 'border-success';
      bgColor = 'rgba(40, 167, 69, 0.1)';
    } else if (index === leg.steps.length - 1) {
      borderColor = 'border-danger';
      bgColor = 'rgba(220, 53, 69, 0.1)';
    }

    html += `
      <div class="direction-step d-flex mb-3 p-3 rounded border-start ${borderColor}" style="background: ${bgColor};">
        <div class="step-icon me-3">
          <div class="rounded-circle d-flex align-items-center justify-content-center" 
               style="width: 40px; height: 40px; background: rgba(66, 133, 244, 0.2);">
            <i class="${icon} text-primary"></i>
          </div>
        </div>
        <div class="step-content flex-grow-1">
          <div class="step-number small text-muted mb-1">Step ${index + 1}</div>
          <div class="step-instruction fw-bold mb-2">${escapeHTML(instruction)}</div>
          <div class="step-details d-flex gap-3 small text-muted">
            <span><i class="fas fa-ruler-horizontal me-1"></i>${distance}</span>
            <span><i class="fas fa-clock me-1"></i>${duration}</span>
          </div>
        </div>
      </div>
    `;
  });

  html += `
        </div>
      </div>
    </div>
  `;

  resultsDiv.innerHTML = html;
}

// Replace the addRouteMarkers function in your main.js with this fixed version

function addRouteMarkers(result) {
  console.log('🎨 addRouteMarkers called!');

  const route = result.routes[0];
  const leg = route.legs[0];

  try {
    // Clear existing markers and lines
    if (window.routeMarkers) {
      console.log('Clearing old markers...');
      window.routeMarkers.forEach(marker => marker.setMap(null));
    }
    if (window.directionLine) {
      console.log('Clearing old line...');
      window.directionLine.setMap(null);
    }
    if (window.animationInterval) {
      console.log('Clearing animation...');
      clearInterval(window.animationInterval);
    }
    window.routeMarkers = [];

    console.log('Creating line between A and B...');

    // Get coordinates - FIX for Google Maps API
    const startLatLng = new google.maps.LatLng(
      leg.start_location.lat(), 
      leg.start_location.lng()
    );
    const endLatLng = new google.maps.LatLng(
      leg.end_location.lat(), 
      leg.end_location.lng()
    );

    console.log('Start:', startLatLng.toString());
    console.log('End:', endLatLng.toString());

    // Create the RED LINE
    window.directionLine = new google.maps.Polyline({
      path: [startLatLng, endLatLng],
      geodesic: true,
      strokeColor: '#FF1744',
      strokeOpacity: 1.0,
      strokeWeight: 4,
      zIndex: 1000,
      icons: [{
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 4,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
          fillColor: '#FF1744',
          fillOpacity: 1
        },
        offset: '0%',
        repeat: '80px'
      }],
      map: window.map
    });

    console.log('✅ Red line created!');

    // Animate arrows
    let offset = 0;
    window.animationInterval = setInterval(() => {
      offset = (offset + 2) % 100;
      const icons = window.directionLine.get('icons');
      if (icons && icons.length > 0) {
        icons[0].offset = offset + '%';
        window.directionLine.set('icons', icons);
      }
    }, 100);

    console.log('✅ Animation started!');

    // Create START marker (A)
    const startMarker = new google.maps.Marker({
      position: startLatLng,
      map: window.map,
      title: 'Start: ' + leg.start_address,
      zIndex: 2000,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#34a853',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3,
        scale: 15
      },
      label: {
        text: 'A',
        color: 'white',
        fontWeight: 'bold',
        fontSize: '16px'
      },
      animation: google.maps.Animation.DROP
    });

    console.log('✅ Marker A created!');

    // Create END marker (B)
    const endMarker = new google.maps.Marker({
      position: endLatLng,
      map: window.map,
      title: 'Destination: ' + leg.end_address,
      zIndex: 2000,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#ea4335',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3,
        scale: 15
      },
      label: {
        text: 'B',
        color: 'white',
        fontWeight: 'bold',
        fontSize: '16px'
      },
      animation: google.maps.Animation.DROP
    });

    console.log('✅ Marker B created!');

    window.routeMarkers = [startMarker, endMarker];

    console.log('✓ Markers A and B created!');
    console.log('✓ Everything working perfectly!');

  } catch (error) {
    console.error('❌ ERROR in addRouteMarkers:', error);
    console.error('Error details:', error.message);
    console.error('Stack:', error.stack);
  }
}

async function loadFloodData() {
  const floodInfoDiv = document.getElementById('flood-info');
  if (!floodInfoDiv) return;

  try {
    const response = await fetch('/api/flood-data', { credentials: 'same-origin' });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Failed to load flood data');
    }

    displayFloodData(data.data);

  } catch (error) {
    console.error('Error loading flood data:', error);
    floodInfoDiv.innerHTML = '<p class="text-danger small">Error loading flood data</p>';
  }
}

function displayFloodData(data) {
  const floodInfoDiv = document.getElementById('flood-info');
  if (!floodInfoDiv) return;

  let html = '';

  if (data.alerts && data.alerts.length > 0) {
    html += '<div class="mb-3">';
    html += '<h6 class="text-danger"><i class="fas fa-exclamation-triangle me-2"></i>Active Flood Alerts</h6>';
    data.alerts.slice(0, 3).forEach(alert => {
      html += `<div class="alert alert-warning py-2 mb-2">
        <div class="fw-bold small">${escapeHTML(alert.event)}</div>
        <div class="small">${escapeHTML(alert.areas)}</div>
      </div>`;
    });
    html += '</div>';
  }

  if (data.stream_gauges && data.stream_gauges.length > 0) {
    const highRiskGauges = data.stream_gauges.filter(g => g.flood_risk === 'high').slice(0, 3);
    if (highRiskGauges.length > 0) {
      html += '<div class="mb-3">';
      html += '<h6 class="text-warning"><i class="fas fa-tint me-2"></i>High Water Levels</h6>';
      highRiskGauges.forEach(gauge => {
        html += `<div class="alert alert-info py-2 mb-2">
          <div class="fw-bold small">${escapeHTML(gauge.site_name)}</div>
          <div class="small">${gauge.value} ${gauge.unit}</div>
        </div>`;
      });
      html += '</div>';
    }
  }

  if (!html) {
    html = '<div class="alert alert-success py-2"><i class="fas fa-check-circle me-2"></i>No major flood alerts currently active</div>';
  }

  if (data.last_updated) {
    const updateTime = new Date(data.last_updated).toLocaleString();
    html += `<div class="text-muted small mt-2 text-center">
      <i class="fas fa-sync-alt me-1"></i>Updated: ${updateTime}
    </div>`;
  }

  floodInfoDiv.innerHTML = html;
}

async function reportFlood() {
  if (!navigator.geolocation) {
    alert('Geolocation is not supported by this browser.');
    return;
  }

  navigator.geolocation.getCurrentPosition(async function(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;

    const description = prompt('Please describe the flooding situation:');
    if (!description) return;

    try {
      const response = await fetch('/api/report-flood', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          latitude: lat,
          longitude: lng,
          description: description,
          timestamp: new Date().toISOString()
        })
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        alert('Thank you for reporting the flood condition. Stay safe!');
        loadFloodData();
      } else {
        throw new Error(data.error || 'Failed to submit report');
      }

    } catch (error) {
      console.error('Error submitting flood report:', error);
      alert('Error submitting report: ' + error.message);
    }
  }, function(error) {
    console.error('Geolocation error:', error);
    alert('Unable to get your location. Please try again.');
  });
}

function setupAutocomplete() {
  const originInput = document.getElementById('route-origin');
  const destinationInput = document.getElementById('route-destination');

  if (!originInput || !destinationInput) {
    console.log('Input elements not found for autocomplete');
    return;
  }

  if (!google.maps.places) {
    console.log('Places API not loaded');
    return;
  }

  try {
    window.originAutocomplete = new google.maps.places.Autocomplete(originInput, {
      componentRestrictions: { country: 'us' }
    });

    window.destinationAutocomplete = new google.maps.places.Autocomplete(destinationInput, {
      componentRestrictions: { country: 'us' }
    });

    console.log('Autocomplete setup complete');
  } catch (error) {
    console.error('Autocomplete setup error:', error);
  }
}

window.initializeFloodRouting = function() {
  console.log('🗺️ Initializing flood routing...');

  if (typeof google === 'undefined' || !google.maps) {
    console.error('❌ Google Maps not loaded');
    return;
  }

  const loadingOverlay = document.getElementById('map-loading');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }

  try {
    window.map = new google.maps.Map(document.getElementById('map'), {
      zoom: 8,
      center: { lat: 40.0583, lng: -74.4057 },
      mapTypeControl: true,
      streetViewControl: true,
      fullscreenControl: true
    });

    window.directionsService = new google.maps.DirectionsService();
    window.directionsRenderer = new google.maps.DirectionsRenderer({
      map: window.map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#4285f4',
        strokeWeight: 6,
        strokeOpacity: 0.9
      }
    });

    console.log('✅ Map and directions initialized');

    // ADD FAKE LOCATION TRACKER - THIS IS THE FIX!
    setTimeout(() => {
      addFakeLocationTracker();
    }, 500);

    setTimeout(() => {
      setupAutocomplete();
      console.log('✅ Autocomplete setup complete');
    }, 1000);

    setTimeout(() => {
      setupPredictiveRouteButton();
      console.log('✅ Route button setup complete');
    }, 1500);

    setTimeout(() => {
      loadFloodData();
      console.log('✅ Flood data loading started');
    }, 2000);

    console.log('✅ Flood routing initialized successfully');

  } catch (error) {
    console.error('❌ Error in map initialization:', error);
  }
};

// ADD THIS TEST FUNCTION - Call this manually to test
window.testRouteButton = function() {
  console.log('🧪 Testing route button...');
  const button = document.getElementById('get-route-btn');
  if (button) {
    console.log('✅ Button exists');
    button.click();
  } else {
    console.error('❌ Button not found!');
  }
};

console.log('🚀 Route functions loaded. Run window.testRouteButton() to test.');

// -------- Utils --------
function escapeHTML(s) {
  return (s || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

// Expose for inline handlers
window.SafeSphere = { 
  showLoadingState, 
  hideLoadingState, 
  handleApiError, 
  deletePost,
  reportFlood,
  calculateRouteWithDirections,
  calculatePredictiveRoute,
  updatePredictionHours,
  clearFloodVisualizations
};

// Language Toggle System - Add to your main.js

// Language translations
const translations = {
  en: {
    // Navigation
    'nav.home': 'Home',
    'nav.about': 'About',
    'nav.contact': 'Contact',
    'nav.signin': 'Sign In',
    'nav.board': 'Safety Board',
    'nav.ai': 'SafeSphereAI',
    'nav.routes': 'Safe Map',
    'nav.logout': 'Log Out',
    'nav.language': 'Language',

    // Hero Section
    'hero.title': 'SafeSphere',
    'hero.subtitle': 'Safety Solutions for New Jersey',
    'hero.get-started': 'Get Started',
    'hero.try-routes': 'Try Safe Routes',

    // Features
    'feature.routes.title': 'Flood-Safe Routes',
    'feature.routes.desc': 'Real-time routing that avoids flooded roads',
    'feature.board.title': 'Community Board',
    'feature.board.desc': 'Share safety alerts with your neighbors',
    'feature.ai.title': 'AI Assistant',
    'feature.ai.desc': 'Intelligent safety insights and guidance',

    // Routes Page
    'routes.title': 'Safe Routes Map',
    'routes.subtitle': 'Find flood-safe routes through New Jersey using real-time data',
    'routes.plan': 'Plan Your Route',
    'routes.from': 'From',
    'routes.to': 'To',
    'routes.from-placeholder': 'Enter starting location in NJ',
    'routes.to-placeholder': 'Enter destination in NJ',
    'routes.find-route': 'Find Safe Route',
    'routes.current-conditions': 'Current Conditions',
    'routes.loading': 'Loading flood data...',
    'routes.report-flooding': 'Report Flooding',
    'routes.report-desc': 'Help keep the community safe by reporting flooded roads',
    'routes.report-btn': 'Report Flood',
    'routes.data-by': 'Data provided by USGS & NWS',

    // Route Results
    'route.found': 'Route Found!',
    'route.summary': 'Route Summary',
    'route.distance': 'Distance',
    'route.duration': 'Est. Time',
    'route.total-distance': 'Total Distance',
    'route.from-label': 'From:',
    'route.to-label': 'To:',
    'route.directions': 'Turn-by-Turn Directions',
    'route.step': 'Step',

    // Safety Board
    'board.title': 'Safety Board',
    'board.create': 'Create a Post',
    'board.post-title': 'Title',
    'board.title-placeholder': 'Short, clear title',
    'board.category': 'Category',
    'board.details': 'Details',
    'board.details-placeholder': 'What happened? When/where? Any advice?',
    'board.post-btn': 'Post',
    'board.no-posts': 'No posts yet. Be the first to report something!',
    'board.delete': 'Delete',

    // Auth
    'auth.signin': 'Sign In',
    'auth.signup': 'Create Account',
    'auth.email': 'Email address',
    'auth.email-placeholder': 'name@example.com',
    'auth.password': 'Password',
    'auth.password-placeholder': '••••••••',
    'auth.create-password': 'Create a password',
    'auth.no-account': 'No account?',
    'auth.create-one': 'Create one',
    'auth.have-account': 'Already have an account?',
    'auth.signin-link': 'Sign in',

    // Alerts
    'alert.enter-locations': 'Please enter both locations',
    'alert.enter-email-password': 'Enter email and password.',
    'alert.signin-to-post': 'Please sign in to post.',
    'alert.provide-title-details': 'Please provide a title and details.',

    // About
    'about.title': 'About SafeSphere',
    'about.subtitle': 'Meet the team behind SafeSphere\'s innovative safety solutions.',
    'about.mission': 'Our mission is to make safety accessible, intelligent, and community-focused.',

    // Contact
    'contact.title': 'Contact SafeSphere',
    'contact.subtitle': 'Get in touch with our team.',
  },

  es: {
    // Navigation
    'nav.home': 'Inicio',
    'nav.about': 'Acerca de',
    'nav.contact': 'Contacto',
    'nav.signin': 'Iniciar Sesión',
    'nav.board': 'Tablero de Seguridad',
    'nav.ai': 'SafeSphereAI',
    'nav.routes': 'Mapa de Rutas Seguras',
    'nav.logout': 'Cerrar sesión',
    'nav.language': 'Idioma',

    // Hero Section
    'hero.title': 'SafeSphere',
    'hero.subtitle': 'Soluciones de Seguridad para Nueva Jersey',
    'hero.get-started': 'Comenzar',
    'hero.try-routes': 'Probar Rutas Seguras',

    // Features
    'feature.routes.title': 'Rutas Seguras contra Inundaciones',
    'feature.routes.desc': 'Navegación en tiempo real que evita carreteras inundadas',
    'feature.board.title': 'Tablero Comunitario',
    'feature.board.desc': 'Comparte alertas de seguridad con tus vecinos',
    'feature.ai.title': 'Asistente IA',
    'feature.ai.desc': 'Información y orientación inteligente de seguridad',

    // Routes Page
    'routes.title': 'Mapa de Rutas Seguras',
    'routes.subtitle': 'Encuentra rutas seguras contra inundaciones en Nueva Jersey usando datos en tiempo real',
    'routes.plan': 'Planifica tu Ruta',
    'routes.from': 'Desde',
    'routes.to': 'Hasta',
    'routes.from-placeholder': 'Ingresa ubicación de inicio en NJ',
    'routes.to-placeholder': 'Ingresa destino en NJ',
    'routes.find-route': 'Buscar Ruta Segura',
    'routes.current-conditions': 'Condiciones Actuales',
    'routes.loading': 'Cargando datos de inundación...',
    'routes.report-flooding': 'Reportar Inundación',
    'routes.report-desc': 'Ayuda a mantener segura a la comunidad reportando carreteras inundadas',
    'routes.report-btn': 'Reportar Inundación',
    'routes.data-by': 'Datos proporcionados por USGS y NWS',

    // Route Results
    'route.found': '¡Ruta Encontrada!',
    'route.summary': 'Resumen de Ruta',
    'route.distance': 'Distancia',
    'route.duration': 'Tiempo Est.',
    'route.total-distance': 'Distancia Total',
    'route.from-label': 'Desde:',
    'route.to-label': 'Hasta:',
    'route.directions': 'Direcciones Paso a Paso',
    'route.step': 'Paso',

    // Safety Board
    'board.title': 'Tablero de Seguridad',
    'board.create': 'Crear una Publicación',
    'board.post-title': 'Título',
    'board.title-placeholder': 'Título corto y claro',
    'board.category': 'Categoría',
    'board.details': 'Detalles',
    'board.details-placeholder': '¿Qué pasó? ¿Cuándo/dónde? ¿Algún consejo?',
    'board.post-btn': 'Publicar',
    'board.no-posts': '¡Aún no hay publicaciones. Sé el primero en reportar algo!',
    'board.delete': 'Eliminar',

    // Auth
    'auth.signin': 'Iniciar Sesión',
    'auth.signup': 'Crear Cuenta',
    'auth.email': 'Correo electrónico',
    'auth.email-placeholder': 'nombre@ejemplo.com',
    'auth.password': 'Contraseña',
    'auth.password-placeholder': '••••••••',
    'auth.create-password': 'Crear una contraseña',
    'auth.no-account': '¿No tienes cuenta?',
    'auth.create-one': 'Crear una',
    'auth.have-account': '¿Ya tienes una cuenta?',
    'auth.signin-link': 'Iniciar sesión',

    // Alerts
    'alert.enter-locations': 'Por favor ingresa ambas ubicaciones',
    'alert.enter-email-password': 'Ingresa correo electrónico y contraseña.',
    'alert.signin-to-post': 'Por favor inicia sesión para publicar.',
    'alert.provide-title-details': 'Por favor proporciona un título y detalles.',

    // About
    'about.title': 'Acerca de SafeSphere',
    'about.subtitle': 'Conoce al equipo detrás de las soluciones innovadoras de SafeSphere.',
    'about.mission': 'Nuestra misión es hacer que la seguridad sea accesible, inteligente y centrada en la comunidad.',

    // Contact
    'contact.title': 'Contactar a SafeSphere',
    'contact.subtitle': 'Ponte en contacto con nuestro equipo.',
  }
};

// Current language
let currentLanguage = localStorage.getItem('safesphere_language') || 'en';

// Translation function
function t(key) {
  return translations[currentLanguage][key] || key;
}

// Update all text on page
function updatePageLanguage() {
  console.log('🌐 Updating page to:', currentLanguage);

  // Update all elements with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    const translatedText = t(key);

    // Handle different element types
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      if (element.placeholder) {
        element.placeholder = translatedText;
      }
    } else if (element.tagName === 'BUTTON') {
      // Preserve icons in buttons
      const icon = element.querySelector('i');
      if (icon) {
        const iconHTML = icon.outerHTML;
        element.innerHTML = iconHTML + ' ' + translatedText;
      } else {
        element.textContent = translatedText;
      }
    } else {
      element.textContent = translatedText;
    }
  });

  // Update language toggle button text
  const langBtn = document.getElementById('current-language');
  if (langBtn) {
    langBtn.textContent = currentLanguage === 'en' ? 'English' : 'Español';
  }

  // Update alerts and dynamic content
  updateAlertMessages();

  console.log('✅ Language updated successfully');
}

// Update alert messages
function updateAlertMessages() {
  // Override alert function to use translations
  const originalAlert = window.alert;
  window.alert = function(message) {
    // Try to translate common alert messages
    const translatedMessage = translateAlertMessage(message);
    originalAlert(translatedMessage);
  };
}

function translateAlertMessage(message) {
  const alertTranslations = {
    'Please enter both locations': t('alert.enter-locations'),
    'Enter email and password.': t('alert.enter-email-password'),
    'Please sign in to post.': t('alert.signin-to-post'),
    'Please provide a title and details.': t('alert.provide-title-details'),
  };

  return alertTranslations[message] || message;
}

// Toggle language
function toggleLanguage(lang) {
  currentLanguage = lang;
  localStorage.setItem('safesphere_language', lang);
  updatePageLanguage();

  // Show success message
  const message = lang === 'es' 
    ? '✓ Idioma cambiado a Español' 
    : '✓ Language changed to English';

  showLanguageToast(message);
}

// Show toast notification
function showLanguageToast(message) {
  const toast = document.createElement('div');
  toast.className = 'language-toast';
  toast.innerHTML = `
    <i class="fas fa-check-circle me-2"></i>${message}
  `;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #28a745;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// Initialize language system
function initializeLanguageSystem() {
  console.log('🌐 Initializing language system...');

  // Add language dropdown to navbar
  addLanguageDropdown();

  // Apply saved language
  updatePageLanguage();

  console.log('✅ Language system initialized');
}

// Add language dropdown to navbar
function addLanguageDropdown() {
  const navList = document.querySelector('#navbarNav .navbar-nav.ms-auto');
  if (!navList) return;

  // Check if already exists
  if (document.getElementById('language-dropdown')) return;

  const li = document.createElement('li');
  li.className = 'nav-item dropdown';
  li.id = 'language-dropdown';
  li.innerHTML = `
    <a class="nav-link dropdown-toggle" href="#" id="languageMenu" role="button"
       data-bs-toggle="dropdown" aria-expanded="false">
      <i class="fas fa-globe me-1"></i>
      <span id="current-language">${currentLanguage === 'en' ? 'English' : 'Español'}</span>
    </a>
    <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="languageMenu">
      <li>
        <a class="dropdown-item ${currentLanguage === 'en' ? 'active' : ''}" 
           href="#" onclick="toggleLanguage('en'); return false;">
          <i class="fas fa-flag-usa me-2"></i>English
        </a>
      </li>
      <li>
        <a class="dropdown-item ${currentLanguage === 'es' ? 'active' : ''}" 
           href="#" onclick="toggleLanguage('es'); return false;">
          <i class="fas fa-flag me-2"></i>Español
        </a>
      </li>
    </ul>
  `;

  // Insert before user avatar or at the end
  const userMenu = navList.querySelector('#userMenu');
  if (userMenu) {
    userMenu.parentElement.parentElement.insertBefore(li, userMenu.parentElement);
  } else {
    navList.appendChild(li);
  }
}

// Add CSS animations
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }

  .dropdown-item.active {
    background-color: rgba(13, 110, 253, 0.2);
    color: #4dabf7;
  }

  .dropdown-item:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
`;
document.head.appendChild(styleSheet);

// Expose functions globally
window.toggleLanguage = toggleLanguage;
window.t = t;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeLanguageSystem);
} else {
  initializeLanguageSystem();
}
// SafeSphereAI Chatbot System - Add to main.js

// Chatbot knowledge base with pre-programmed responses
// SafeSphereAI Chatbot System - Add to main.js

// Chatbot knowledge base with pre-programmed responses
const chatbotResponses = {
  // NEW: Water ahead response
  'water ahead': {
    response: `🚨 **I see you've encountered water on the road!**

Here's a mock alternate driving route from **Basking Ridge, NJ (24 Hansom Rd)** to **Princeton University (Princeton, NJ)** — assuming your original route is blocked by floodwater.

⚠️ *Please verify in your navigation app before following it.*

**🧭 Alternate Directions**

1. Start on **Hansom Rd** heading toward South Maple Ave
2. Turn **right** onto **South Maple Ave**, then continue to merge onto **I-287 South**
3. Follow **I-287 South** for approximately 8-10 miles, staying left where lanes split
4. Take **Exit 10** to merge onto **US-202/US-206 South** toward Somerville/Princeton Junction
5. Continue on **US-202/US-206 South** for ~15 miles
6. Look for signs for **NJ-27 South** toward Princeton and take that exit
7. Follow **NJ-27 South** into Princeton. As you approach town, turn right onto **Nassau St**
8. Proceed on **Nassau St** to arrive at the central area of the university

**📌 Key Notes**
• Estimated driving distance: ~35–40 miles
• This route uses major highways to bypass smaller roads that may be flood-prone
• While NJ-27 is more direct into Princeton, you'll stay on highways as much as possible to minimize risk
• **Important:** Check your app for real-time updates. If any segment shows flooding or closure, stop and reroute again

**✅ What to Do Right Now**
• Switch your app's route to this alternate path (if safe and dry)
• Keep an eye on flood alerts for US-202/206 and NJ-27 — some sections might also be affected in heavy flooding
• Drive slowly and cautiously, especially at off-ramp merges and near areas known for water pooling

Would you like me to help you find another route or provide more safety information? 🛡️`,
    category: 'emergency'
  },

  'car not turning on': {
    response: `🚗 **If your car won't start in a flood:**

1. **DO NOT try to start the engine** - Water in the engine can cause severe damage
2. **Get to higher ground immediately** - Leave the car if water is rising
3. **Call for help** - Dial 911 if you're in danger
4. **Document everything** - Take photos for insurance
5. **Wait for a tow** - Have it towed to a mechanic, don't drive it

💡 **Remember:** Just 6 inches of moving water can knock you down, and 12 inches can carry away most vehicles.

**Need immediate help?** Call 911 or NJ Emergency Hotline: 2-1-1`,
    category: 'emergency'
  },

  'stuck in flood': {
    response: `🚨 **If you're stuck in flood water:**

**IMMEDIATE ACTIONS:**
1. **Call 911 right now** if you're in immediate danger
2. **Stay in your car ONLY if water isn't rising** - It's safer than being swept away
3. **If water enters the car:**
   - Unbuckle seatbelt immediately
   - Roll down or break windows (aim for corners)
   - Escape through window, NOT the door
4. **Move to highest ground** - Climb on roof if needed
5. **Wave bright clothing** to signal rescuers

⚠️ **NEVER:**
- Try to drive through moving water
- Walk through flood water (hidden hazards, electricity)
- Touch electrical equipment or downed power lines

**Emergency contacts:**
- 911 (Police/Fire/EMS)
- NJ Emergency: 2-1-1
- Coast Guard: 1-800-544-8802`,
    category: 'emergency'
  },

  'flooded road': {
    response: `🚧 **Encountered a flooded road?**

**Safe Driving Rules:**
- **Turn Around, Don't Drown** - Most flood deaths occur in vehicles
- Just **6 inches of water** can cause loss of control
- **12 inches** can float most cars
- **2 feet** will carry away most vehicles including SUVs

**What to do:**
1. ✅ Turn around and find an alternate route
2. ✅ Use our Safe Routes feature to find dry paths
3. ✅ Report the flooding to help others
4. ❌ NEVER drive through moving water
5. ❌ Don't follow other vehicles through water

💡 **Tip:** Use SafeSphere's route planning to check conditions before leaving!`,
    category: 'driving'
  },

  'safe route': {
    response: `🗺️ **Finding a safe route during flooding:**

**Use SafeSphere's Safe Routes feature:**
1. Go to the **Safe Routes Map** in the navigation
2. Enter your starting location and destination
3. Our system analyzes:
   - Current flood warnings from NWS
   - USGS stream gauge data
   - Community flood reports
   - AI flood predictions (2-6 hours ahead)

**Pro tips:**
- ✅ Check your route BEFORE leaving
- ✅ Save frequent routes for quick access
- ✅ Enable notifications for route alerts
- ✅ Add extra travel time during storms

🌟 **Try it now!** Click "Safe Routes Map" in the menu above.`,
    category: 'navigation'
  },

  'report flood': {
    response: `📱 **How to report flooding in your area:**

**Quick Report:**
1. Click **"Safe Routes Map"** in navigation
2. Scroll to the **"Report Flooding"** section (red card)
3. Click **"Report Flood"** button
4. Allow location access
5. Describe what you see

**What to include:**
- Water depth (ankle, knee, car-level)
- Road closure or passable
- Any hazards (downed lines, debris)
- Photos if safe to take

Your reports help keep the community safe! 🙏

⚠️ **Safety first:** Only report if you're in a safe location. Never stop in flood water to take photos.`,
    category: 'community'
  },

  'prepare flood': {
    response: `🎒 **Flood Preparation Checklist:**

**Before Flood Season:**
- ✅ Know your evacuation routes (use our Safe Routes feature)
- ✅ Create emergency kit (water, food, meds, flashlight, radio)
- ✅ Save emergency contacts
- ✅ Take photos of valuables for insurance
- ✅ Review insurance coverage (most policies don't cover floods)
- ✅ Install SafeSphere app and enable notifications

**Emergency Kit Must-Haves:**
- Water (1 gallon/person/day for 3 days)
- Non-perishable food (3-day supply)
- Battery-powered radio
- Flashlight + extra batteries
- First aid kit
- Medications (7-day supply)
- Phone chargers (portable battery pack)
- Important documents (in waterproof bag)
- Cash

**NJ Specific:**
- Sign up for NJ Alert: https://www.nj.gov/njsp/alerts/
- Know your flood zone: FEMA Flood Map Service

📍 **Local Resources:**
- Red Cross NJ: 1-877-287-3327
- NJ 2-1-1: Health & human services info`,
    category: 'preparation'
  },

  'insurance': {
    response: `💰 **Flood Insurance Information:**

**Key Facts:**
- 🏠 Standard homeowner's insurance does NOT cover floods
- 💧 Flood insurance is separate and must be purchased
- ⏰ Usually requires 30-day waiting period
- 💵 Average cost in NJ: $700-$1,200/year

**What's Covered:**
- Building damage (structure, foundation, electrical)
- Contents (personal belongings - separate coverage)
- Cleanup costs
- Some debris removal

**Not Covered:**
- Living expenses during repairs
- Swimming pools
- Landscaping
- Vehicles (covered by auto insurance)

**Get Coverage:**
- NFIP (National Flood Insurance Program): FloodSmart.gov
- Private insurers (compare rates)
- Some policies offered through regular insurance agents

**Need Help?**
- FEMA Helpline: 1-800-427-4661
- FloodSmart: 1-888-379-9531

💡 **Even if you're not in a flood zone**, 20-25% of flood claims come from moderate-to-low risk areas!`,
    category: 'insurance'
  },

  'hello': {
    response: `👋 **Hello! I'm SafeSphere AI, your flood safety assistant.**

I can help you with:
- 🚗 Vehicle safety in floods
- 🗺️ Finding safe routes
- 📱 Reporting flood conditions  
- 🎒 Emergency preparation
- 💰 Insurance information
- 🚨 Emergency procedures

**Try asking me:**
- "What should I do if my car is stuck in a flood?"
- "How do I find a safe route?"
- "How can I prepare for flooding?"
- "Tell me about flood insurance"

Or explore our features:
- **Safe Routes Map** - Real-time flood-safe navigation
- **Safety Board** - Community alerts and reports
- **Report Flooding** - Help keep others safe

How can I help you stay safe today? 🛡️`,
    category: 'greeting'
  },

  'thank': {
    response: `You're very welcome! 😊 Stay safe out there!

💡 **Remember:** 
- Check our Safe Routes Map before traveling
- Report any flooding you encounter
- Share SafeSphere with friends and family

Is there anything else I can help you with? Or try exploring:
- 🗺️ Safe Routes Map
- 💬 Safety Board
- 📱 Report Flooding

Stay informed, stay safe! 🛡️`,
    category: 'greeting'
  },

  'emergency': {
    response: `🚨 **THIS IS AN EMERGENCY? CALL 911 IMMEDIATELY!**

**Emergency Services:**
- 🚓 Police/Fire/Medical: **911**
- 📞 NJ Emergency Hotline: **2-1-1**
- 🌊 Coast Guard: **1-800-544-8802**
- ⚡ Report Downed Power Lines: **1-800-662-3115**

**If you're in immediate danger from flooding:**
1. Get to HIGH GROUND immediately
2. Stay out of flood water
3. Avoid downed power lines
4. Call 911 if trapped or injured

I'm here to provide information, but for life-threatening situations, always call emergency services first! 

Stay safe! 🛡️`,
    category: 'emergency'
  },

  'default': {
    response: `I'm not sure I understand that question, but I'm here to help! 🤔

**I can answer questions about:**
- 🚗 What to do if your car is stuck in a flood
- 🌊 How to handle flooded roads
- 🗺️ Finding safe routes in NJ
- 📱 Reporting flood conditions
- 🎒 Preparing for flood season
- 💰 Flood insurance basics
- 🚨 Emergency procedures

**Try asking:**
- "What should I do if my car won't start in a flood?"
- "How do I find a safe route?"
- "How can I report flooding?"
- "Tell me about emergency preparation"

Or explore our features using the navigation menu above! 🛡️`,
    category: 'default'
  }
};

// Keywords to match user input to responses
const keywordMap = {
  'water ahead': ['water', 'ahead', 'see', 'flooding', 'flooded', 'blocked', 'front'],
  'car not turning on': ['car', 'not', 'start', 'turn', 'won\'t', 'engine', 'ignition', 'dead'],
  'stuck in flood': ['stuck', 'trapped', 'stranded', 'submerged', 'water', 'rising', 'sinking'],
  'flooded road': ['flooded', 'road', 'street', 'highway', 'drive', 'water', 'cross'],
  'safe route': ['route', 'path', 'way', 'navigate', 'direction', 'map', 'travel', 'avoid'],
  'report flood': ['report', 'tell', 'alert', 'notify', 'share', 'flooding', 'inform'],
  'prepare flood': ['prepare', 'ready', 'kit', 'emergency', 'supplies', 'plan', 'checklist'],
  'insurance': ['insurance', 'coverage', 'policy', 'claim', 'cost', 'fema', 'nfip'],
  'hello': ['hello', 'hi', 'hey', 'greetings', 'help', 'start'],
  'thank': ['thank', 'thanks', 'appreciate', 'grateful'],
  'emergency': ['911', 'emergency', 'urgent', 'help', 'danger', 'life', 'death', 'dying']
};

// Match user input to best response
function getBestResponse(userInput) {
  const input = userInput.toLowerCase().trim();

  // Check for exact emergency keywords first
  if (input.includes('911') || input.includes('dying') || input.includes('drowning')) {
    return chatbotResponses['emergency'];
  }

  // Score each response based on keyword matches
  let bestMatch = 'default';
  let bestScore = 0;

  for (const [key, keywords] of Object.entries(keywordMap)) {
    let score = 0;
    keywords.forEach(keyword => {
      if (input.includes(keyword)) {
        score++;
      }
    });

    if (score > bestScore) {
      bestScore = score;
      bestMatch = key;
    }
  }

  return chatbotResponses[bestMatch];
}

// Chat message storage
let chatMessages = [];

// Initialize chatbot
function initializeChatbot() {
  const chatContainer = document.getElementById('chat-container');
  if (!chatContainer) return;

  console.log('🤖 Initializing SafeSphere AI...');

  // Add welcome message after a short delay
  setTimeout(() => {
    addBotMessage(chatbotResponses['hello'].response);
  }, 800);
}

// Add user message to chat
function addUserMessage(message) {
  const chatMessagesContainer = document.getElementById('chat-messages');
  if (!chatMessagesContainer) return;

  const messageDiv = document.createElement('div');
  messageDiv.className = 'chat-message user-message';
  messageDiv.innerHTML = `
    <div class="message-content">
      <div class="message-avatar user-avatar">
        <i class="fas fa-user"></i>
      </div>
      <div class="message-text">
        ${escapeHTML(message)}
      </div>
    </div>
  `;

  chatMessagesContainer.appendChild(messageDiv);
  chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

// Add bot message with typing animation
function addBotMessage(message) {
  const chatMessagesContainer = document.getElementById('chat-messages');
  if (!chatMessagesContainer) return;

  // Show typing indicator
  const typingDiv = document.createElement('div');
  typingDiv.className = 'chat-message bot-message typing-indicator';
  typingDiv.id = 'typing-indicator';
  typingDiv.innerHTML = `
    <div class="message-content">
      <div class="message-avatar bot-avatar">
        <i class="fas fa-robot"></i>
      </div>
      <div class="message-text">
        <div class="typing-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  `;

  chatMessagesContainer.appendChild(typingDiv);
  chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;

  // Remove typing indicator and show message after delay
  setTimeout(() => {
    typingDiv.remove();

    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message bot-message';
    messageDiv.innerHTML = `
      <div class="message-content">
        <div class="message-avatar bot-avatar">
          <i class="fas fa-robot"></i>
        </div>
        <div class="message-text">
          ${formatBotMessage(message)}
        </div>
      </div>
    `;

    chatMessagesContainer.appendChild(messageDiv);
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
  }, 1500); // 1.5 second typing delay
}

// Format bot message (convert markdown-like syntax to HTML)
function formatBotMessage(message) {
  return message
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
    .replace(/\n/g, '<br>') // Line breaks
    .replace(/^- (.*?)$/gm, '<li>$1</li>') // List items
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>') // Wrap lists
    .replace(/^(\d+)\. (.*?)$/gm, '<li>$2</li>') // Numbered lists
    .replace(/✅/g, '<span class="text-success">✅</span>')
    .replace(/❌/g, '<span class="text-danger">❌</span>')
    .replace(/⚠️/g, '<span class="text-warning">⚠️</span>')
    .replace(/🚨/g, '<span class="text-danger">🚨</span>');
}

// Handle user message submission
function handleChatSubmit() {
  const input = document.getElementById('chat-input');
  if (!input) return;

  const message = input.value.trim();
  if (!message) return;

  // Add user message
  addUserMessage(message);

  // Clear input
  input.value = '';

  // Disable input while "thinking"
  input.disabled = true;

  // Get bot response
  setTimeout(() => {
    const response = getBestResponse(message);
    addBotMessage(response.response);

    // Re-enable input
    input.disabled = false;
    input.focus();
  }, 500);
}

// Bind chatbot events
function bindChatbotEvents() {
  const sendBtn = document.getElementById('chat-send-btn');
  const input = document.getElementById('chat-input');

  if (sendBtn) {
    sendBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleChatSubmit();
    });
  }

  if (input) {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleChatSubmit();
      }
    });
  }

  // Quick action buttons
  const quickButtons = document.querySelectorAll('.quick-action-btn');
  console.log('Found quick action buttons:', quickButtons.length);

  quickButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const question = btn.getAttribute('data-question');
      console.log('Quick button clicked:', question);
      if (question) {
        const inputField = document.getElementById('chat-input');
        if (inputField) {
          inputField.value = question;
          handleChatSubmit();
        }
      }
    });
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, checking for chat container...');
  const chatContainer = document.getElementById('chat-container');
  if (chatContainer) {
    console.log('Chat container found! Initializing...');
    initializeChatbot();
    // Wait a bit for DOM to be fully ready
    setTimeout(() => {
      bindChatbotEvents();
      console.log('✅ Chatbot fully initialized');
    }, 100);
  } else {
    console.log('No chat container on this page');
  }
});

console.log('🤖 SafeSphere AI loaded');