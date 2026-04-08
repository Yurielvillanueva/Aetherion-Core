const staffGrid = document.getElementById('staff-grid');

async function loadStaff() {
  const response = await fetch('/api/staff');
  const json = await response.json();
  const staff = json.staff || [];
  staffGrid.innerHTML = staff.length ? staff.map(member => `
    <article class="feature-card staff-card">
      <img src="${member.avatar}" alt="${member.username}" />
      <div>
        <h3>${member.username}</h3>
        <p>${member.role}</p>
      </div>
    </article>
  `).join('') : '<div class="card"><p>No staff found.</p></div>';
}

window.addEventListener('DOMContentLoaded', loadStaff);
