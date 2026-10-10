const controls = document.querySelector('.controls');
const search = document.querySelector('#search');
const buttons = [...document.querySelectorAll('[data-filter]')];
const projects = [...document.querySelectorAll('.project')];
const count = document.querySelector('#result-count');
let category = 'All';
function filterProjects() {
  const term = search.value.trim().toLowerCase();
  let visible = 0;
  for (const project of projects) {
    project.hidden = !(category === 'All' || project.dataset.category === category) || !project.dataset.search.includes(term);
    if (!project.hidden) visible++;
  }
  count.textContent = `${visible} of ${projects.length} projects`;
  document.querySelector('.empty').hidden = visible !== 0;
}
controls.hidden = false;
count.hidden = false;
buttons.forEach(button => button.addEventListener('click', () => {
  category = button.dataset.filter;
  buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  filterProjects();
}));
search.addEventListener('input', filterProjects);
function showLinkedProject() {
  const id = location.hash.slice(1);
  const project = projects.find(item => item.id === id);
  if (!project) return;
  category = 'All'; search.value = '';
  buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === 'All')));
  filterProjects();
  project.querySelector('details').open = true;
  project.scrollIntoView();
}
window.addEventListener('hashchange', showLinkedProject);
document.querySelector('a[href="#ai-for-life"]').addEventListener('click', () => setTimeout(showLinkedProject, 0));
filterProjects();
showLinkedProject();
