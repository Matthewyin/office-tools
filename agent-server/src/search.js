export async function searchWeb(query, config) {
  if (!query || !query.trim()) {
    return [];
  }

  if (config.searchProvider === 'brave') {
    return await searchWithBrave(query, config);
  }

  return [{
    title: '本地搜索后端已连通',
    url: 'http://127.0.0.1:30031/api/health',
    snippet: '当前 SEARCH_PROVIDER=mock。配置真实搜索 API 后，这里会返回网页搜索结果。',
    source: 'mock',
  }];
}

async function searchWithBrave(query, config) {
  if (!config.braveSearchApiKey) {
    throw new Error('缺少 BRAVE_SEARCH_API_KEY。');
  }

  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', '5');

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'X-Subscription-Token': config.braveSearchApiKey,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Brave Search 请求失败 (${response.status}): ${text}`);
  }

  const data = await response.json();
  return (data.web?.results || []).map(item => ({
    title: item.title || '',
    url: item.url || '',
    snippet: item.description || '',
    source: 'brave',
  }));
}
