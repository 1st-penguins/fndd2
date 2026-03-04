const fs = require('fs');
const path = require('path');

const examDir = 'exam';
const files = fs.readdirSync(examDir).filter(f => 
  f.endsWith('.html') && !f.includes('모의고사')
);

let count = 0;

files.forEach(filename => {
  const filepath = path.join(examDir, filename);
  let content = fs.readFileSync(filepath, 'utf8');
  
  const oldPattern = '      <div class="question-indicators" id="question-indicators">';
  const newPattern = `      <div class="question-indicators-container">
        <div class="question-indicators" id="question-indicators">`;
  
  if (content.includes(oldPattern)) {
    content = content.replace(oldPattern, newPattern);
    
    const oldClose = `        <!-- 문제 인디케이터는 자바스크립트로 동적 생성됩니다 -->
      </div>
    </div>`;
    const newClose = `          <!-- 문제 인디케이터는 자바스크립트로 동적 생성됩니다 -->
        </div>
      </div>
    </div>`;
    
    content = content.replace(oldClose, newClose);
    
    fs.writeFileSync(filepath, content, 'utf8');
    console.log(`Updated: ${filename}`);
    count++;
  }
});

console.log(`\nComplete! Total files updated: ${count}`);


