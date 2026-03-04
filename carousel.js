// ─── RYDR carousel.js ────────────────────────────────────────────────────────
const REVIEWS = [
  { s:5, t:'"Saved 450 points on my commute today! The platform is so easy to use."',           n:'Sanjay Kumar',           r:'Daily Commuter',       photo:'https://randomuser.me/api/portraits/men/44.jpg'   },
  { s:5, t:'"Found a carpool buddy within minutes and saved so much on fuel this month!"',      n:'Akash Geo',              r:'Office Commuter',      photo:'https://randomuser.me/api/portraits/men/32.jpg'   },
  { s:5, t:'"The rewards system is genius. I earn enough points for free coffee every week!"',  n:'Shresta Brijesh',        r:'Frequent Rider',       photo:'https://randomuser.me/api/portraits/women/68.jpg' },
  { s:5, t:'"I love how RYDR encourages sustainable commuting. A win for my wallet and the planet!"', n:'Silpa Suresh',    r:'Eco-conscious Commuter',photo:'https://randomuser.me/api/portraits/women/76.jpg'},
  { s:5, t:'"The app is super intuitive and the support team is fantastic. Highly recommend!"', n:'Shahir N',               r:'Tech Enthusiast',      photo:'https://randomuser.me/api/portraits/men/22.jpg'   },
  { s:5, t:'"RYDR completely changed how I commute. Saved so much money and met great people!"',n:'Jyotsanna Teressa George',r:'Urban Commuter',      photo:'https://randomuser.me/api/portraits/women/45.jpg' },
  { s:5, t:'"The gamification is so motivating! I choose greener options just to earn more points."', n:'Jackson Shelvi',  r:'Sustainable Commuter', photo:'https://randomuser.me/api/portraits/men/23.jpg'   },
];

function initCarousel(boxId, dotsId) {
  const box  = document.getElementById(boxId);
  const dotsEl = document.getElementById(dotsId);
  let cur = 0;

  REVIEWS.forEach((rv, i) => {
    const slide = document.createElement('div');
    slide.className = 'review-slide' + (i === 0 ? ' active' : '');
    slide.innerHTML = `
      <div class="stars">${'★'.repeat(rv.s)}</div>
      <p class="review-text">${rv.t}</p>
      <div class="reviewer">
        <img class="avatar" src="${rv.photo}" alt="${rv.n}">
        <div><div class="rev-name">${rv.n}</div><div class="rev-role">${rv.r}</div></div>
      </div>`;
    box.appendChild(slide);

    const dot = document.createElement('div');
    dot.className = 'dot' + (i === 0 ? ' active' : '');
    dot.onclick = () => goTo(i);
    dotsEl.appendChild(dot);
  });

  function goTo(n) {
    const slides = box.querySelectorAll('.review-slide');
    const dots   = dotsEl.querySelectorAll('.dot');
    slides[cur].classList.remove('active'); dots[cur].classList.remove('active');
    cur = (n + REVIEWS.length) % REVIEWS.length;
    slides[cur].classList.add('active'); dots[cur].classList.add('active');
  }

  setInterval(() => goTo(cur + 1), 4200);
}