// ui/news.js

const newsMatrixSection = document.getElementById('news-matrix-section');
const kpiHeaders = ["Supply Availability", "Raw Material Cost", "Logistics & Freight Cost", "Market Demand", "OTIF"];

const KPI_BG_COLORS = {
    Positive: 'bg-green-50',
    Negative: 'bg-red-50',
    Neutral: 'bg-white'
};

function createKpiCellHtml(impact) {
    const safeImpact = (impact === 'Positive' || impact === 'Negative') ? impact : 'Neutral';
    const indicatorClass = `indicator-${safeImpact.toLowerCase()}`;
    
    if (safeImpact === 'Neutral') {
        return `<span class="indicator-neutral">-</span>`;
    }
    
    const path = safeImpact === 'Positive' ? 'M12 4l8 8H4l8-8z' : 'M12 20l-8-8h16l-8 8z';
    return `<svg class="h-4 w-4 inline-block ${indicatorClass}" fill="currentColor" viewBox="0 0 24 24">
                <path d="${path}"></path>
            </svg>`;
}

function renderNewsMatrix(allArticles) {
    newsMatrixSection.innerHTML = '';
    if (!allArticles || allArticles.length === 0) {
        newsMatrixSection.innerHTML = `<p class="text-gray-500 p-4">No news articles found.</p>`;
        return;
    }

    const table = document.createElement('table');
    table.id = 'news-matrix-table';
    table.className = 'min-w-full';
    
    const thead = document.createElement('thead');
    thead.innerHTML = `<tr>
        <th class="article-column">Article</th>
        <th class="category-column">Category</th>
        ${kpiHeaders.map(name => `<th class="kpi-column">${name}</th>`).join('')}
    </tr>`;
    
    const tbody = document.createElement('tbody');
    allArticles.forEach((article, index) => {
        const row = document.createElement('tr');
        row.id = `article-row-${index}`;
        
        const articleCell = document.createElement('td');
        articleCell.className = 'article-column article-title-cell';
        articleCell.innerHTML = `<a href="${article.url}" target="_blank" rel="noopener noreferrer">${article.title}</a>`;
        row.appendChild(articleCell);

        const categoryCell = document.createElement('td');
        categoryCell.className = 'category-column';
        categoryCell.textContent = article.category.charAt(0).toUpperCase() + article.category.slice(1);
        row.appendChild(categoryCell);

        kpiHeaders.forEach(header => {
            const kpiCell = document.createElement('td');
            kpiCell.className = 'kpi-cell kpi-column';
            kpiCell.id = `kpi-placeholder-matrix-${index}-${header.replace(/\s+/g, '')}`;
            kpiCell.innerHTML = `<div class="kpi-loader-small"></div>`;
            row.appendChild(kpiCell);
        });

        tbody.appendChild(row);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    newsMatrixSection.appendChild(table);
}

function updateMatrixCells(matrixIndex, kpiData) {
    kpiHeaders.forEach(header => {
        const matrixCell = document.getElementById(`kpi-placeholder-matrix-${matrixIndex}-${header.replace(/\s+/g, '')}`);
            if (matrixCell) {
                const impact = kpiData[header] || 'Neutral';
                matrixCell.className = `kpi-cell kpi-column ${KPI_BG_COLORS[impact]}`;
                matrixCell.innerHTML = createKpiCellHtml(impact);
            }
    });
}

async function fetchAndDisplayNews() {
    try {
        const response = await fetch('http://127.0.0.1:5000/api/supply-chain-news');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const newsData = await response.json();
        
        const allArticles = [];
        let matrixIndexCounter = 0;
        for (const category in newsData) {
            newsData[category].forEach(article => {
                allArticles.push({
                    ...article,
                    category: category,
                    matrixIndex: matrixIndexCounter
                });
                matrixIndexCounter++;
            });
        }

        renderNewsMatrix(allArticles);

        allArticles.forEach(article => {
            fetch('http://127.0.0.1:5000/api/analyze-article', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ article: article })
            })
            .then(res => res.json())
            .then(kpiData => {
                const allNeutral = Object.values(kpiData).every(val => val === 'Neutral');

                if (allNeutral) {
                    const row = document.getElementById(`article-row-${article.matrixIndex}`);
                    if (row) row.style.display = 'none';
                } else {
                    updateMatrixCells(article.matrixIndex, kpiData);
                }
            })
            .catch(err => console.error("Error analyzing article:", article.title, err));
        });

    } catch (error) {
        console.error('Error fetching or displaying news:', error);
        newsMatrixSection.innerHTML = `<div class="p-4"><h4 class="font-bold text-gray-800">News Feed</h4><p class="text-sm text-red-500">Could not load news feed. Please ensure the backend server is running.</p></div>`;
    }
}

export function initNews() {
    fetchAndDisplayNews();
}