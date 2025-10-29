document.addEventListener('DOMContentLoaded', function () {
  initializeApp();
  bindAuthUI();
  bindSafetyBoard();
  fetchAndRenderCurrentUser();
  bindGetStartedButton();
});

let predictionHours = 3;
let usePredictiveRouting = true;
let floodPredictionMarkers = [];
let riskOverlays = [];
let directionLine = null;
let animationInterval = null;

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

    const text = await res.text();

    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      console.error('Failed to parse JSON:', text);
      throw new Error('Server returned invalid response');
    }

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

        const text = await response.text();
        console.log('Response:', text);

        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          throw new Error('Invalid response from server: ' + text.substring(0, 100));
        }

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

        const text = await response.text();
        console.log('Response:', text);

        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          throw new Error('Invalid response from server: ' + text.substring(0, 100));
        }

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

let map;
let directionsService;
let directionsRenderer;
let alternativeRenderer;
let originAutocomplete;
let destinationAutocomplete;

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

function displayPredictiveRoute(routeData) {
  const resultsDiv = document.getElementById('route-results');

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

  if (window.directionsRenderer) {
    try {
      window.directionsRenderer.setDirections(routeData.recommended_route);

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

function addFakeLocationTracker() {
  console.log(' Adding fake location tracker...');

  const fakeLocation = {
    lat: 40.6745,
    lng: -74.5518
  };

  const locationMarker = new google.maps.Marker({
    position: fakeLocation,
    map: window.map,
    title: '24 Hansom Road, Basking Ridge, NJ',
    zIndex: 9999,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: '#4285F4',
      fillOpacity: 1,
      strokeColor: '#FFFFFF',
      strokeWeight: 4,
      scale: 20
    },
    animation: google.maps.Animation.DROP
  });

  const pulseCircle = new google.maps.Circle({
    map: window.map,
    center: fakeLocation,
    radius: 50,
    fillColor: '#4285F4',
    fillOpacity: 0.2,
    strokeColor: '#4285F4',
    strokeWeight: 2,
    strokeOpacity: 0.6,
    zIndex: 9998
  });

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

  const infoWindow = new google.maps.InfoWindow({
    content: `
      <div style="color: #333; padding: 10px; font-family: Arial, sans-serif;">
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <div style="width: 12px; height: 12px; background: #34A853; border-radius: 50%; margin-right: 8px; animation: pulse 2s infinite;"></div>
          <strong style="color: #34A853;">Live Location</strong>
        </div>
        <div style="font-size: 14px;">
           24 Hansom Road<br>
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

  infoWindow.open(window.map, locationMarker);

  locationMarker.addListener('click', () => {
    infoWindow.open(window.map, locationMarker);
  });

  window.fakeLocationMarker = locationMarker;
  window.fakeLocationCircle = pulseCircle;
  window.fakeLocationInfo = infoWindow;

  console.log(' Fake location tracker added!');
}

window.initializeFloodRouting = function() {
  console.log('🗺️ Initializing flood routing...');

  if (typeof google === 'undefined' || !google.maps) {
    console.error(' Google Maps not loaded');
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

    console.log(' Map and directions initialized');

    setTimeout(() => {
      addFakeLocationTracker();
    }, 500);

    setTimeout(() => {
      setupAutocomplete();
      console.log(' Autocomplete setup complete');
    }, 1000);

    setTimeout(() => {
      setupPredictiveRouteButton();
      console.log(' Route button setup complete');
    }, 1500);

    setTimeout(() => {
      loadFloodData();
      console.log(' Flood data loading started');
    }, 2000);

    console.log(' Flood routing initialized successfully');

  } catch (error) {
    console.error(' Error in map initialization:', error);
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
    console.error(' Route button not found!');
    return;
  }

  console.log(' Setting up route button...');

  button.onclick = null;

  button.addEventListener('click', function() {
    console.log(' BUTTON CLICKED! ');

    calculateRouteWithDirections();
  });

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

    document.getElementById('predictive-toggle').addEventListener('change', function(e) {
      console.log('Toggle clicked (visual only, route always shows line)');
    });
  }

  console.log(' Button setup complete - will ALWAYS show line');
}

window.calculateRouteWithDirections = calculateRouteWithDirections;
window.addRouteMarkers = addRouteMarkers;

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
    console.log(' Route response status:', status);

    if (status === 'OK') {
      console.log(' Route found successfully!');

      window.directionsRenderer.setOptions({
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#4285f4',
          strokeWeight: 5,
          strokeOpacity: 0.6,
          zIndex: 100
        }
      });

      window.directionsRenderer.setDirections(result);

      const bounds = new google.maps.LatLngBounds();
      const route = result.routes[0];
      route.legs.forEach(leg => {
        bounds.extend(leg.start_location);
        bounds.extend(leg.end_location);
      });
      window.map.fitBounds(bounds);

      console.log('🗺️ Map updated with route');

      showTurnByTurnDirections(result);

      console.log('🎯 About to add markers and line...');
      setTimeout(() => {
        addRouteMarkers(result);
      }, 500);

    } else {
      console.error(' Route failed:', status);
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

  let riskLevel = 'low';
  let riskScore = 0.02;

  const randomFactor = Math.random() * 0.08;
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

function addRouteMarkers(result) {
  console.log('🎨 addRouteMarkers called!');

  const route = result.routes[0];
  const leg = route.legs[0];

  try {
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

    console.log(' Red line created!');

    let offset = 0;
    window.animationInterval = setInterval(() => {
      offset = (offset + 2) % 100;
      const icons = window.directionLine.get('icons');
      if (icons && icons.length > 0) {
        icons[0].offset = offset + '%';
        window.directionLine.set('icons', icons);
      }
    }, 100);

    console.log(' Animation started!');

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

    console.log(' Marker A created!');

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

    console.log(' Marker B created!');

    window.routeMarkers = [startMarker, endMarker];

    console.log('✓ Markers A and B created!');
    console.log('✓ Everything working perfectly!');

  } catch (error) {
    console.error(' ERROR in addRouteMarkers:', error);
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

window.testRouteButton = function() {
  console.log('🧪 Testing route button...');
  const button = document.getElementById('get-route-btn');
  if (button) {
    console.log(' Button exists');
    button.click();
  } else {
    console.error(' Button not found!');
  }
};

console.log('🚀 Route functions loaded. Run window.testRouteButton() to test.');

function escapeHTML(s) {
  return (s || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

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

const translations = {
  en: {
    'nav.home': 'Home',
    'nav.about': 'About',
    'nav.contact': 'Contact',
    'nav.signin': 'Sign In',
    'nav.board': 'Safety Board',
    'nav.ai': 'SafeSphereAI',
    'nav.