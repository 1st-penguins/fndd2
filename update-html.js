const fs = require('fs');
const path = require('path');

const examDir = 'exam';
const files = fs.readdirSync(examDir).filter(f => 
  f.endsWith('.html') && !f.includes('\ubaa8\uc758\uace0\uc0ac')
);

let count = 0;

files.forEach(filename => {
  const filepath = path.join(examDir, filename);
  let content = fs.readFileSync(filepath, 'utf8');
  
  const oldOpen = '      <div class="question-indicators" id="question-indicators">';
  const newOpen = '      <div class="question-indicators-container">\n        <div class="question-indicators" id="question-indicators">';
  
  if (content.includes(oldOpen)) {
    content = content.replace(oldOpen, newOpen);
    
    const pattern1 = '</div>\n    </div>\n  </div>\n  \n  <main class="main-content';
    const pattern2 = '</div>\n      </div>\n    </div>\n  </div>\n  \n  <main class="main-content';
    
    content = content.replace(pattern1, pattern2);
    
    fs.writeFileSync(filepath, content, 'utf8');
    console.log('Updated: ' + filename);
    count++;
  }
});

console.log('\nComplete! Total: ' + count);


