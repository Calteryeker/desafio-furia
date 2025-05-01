const axios = require('axios');
const cheerio = require('cheerio');

async function getLiveMatches() {
  const res = await axios.get('https://www.hltv.org/matches');
  const $ = cheerio.load(res.data);
  const matches = [];

  $('.liveMatch').each((_, el) => {
    const teams = $(el).find('.matchTeamName').map((i, el) => $(el).text()).get();
    if (teams.includes('FURIA')) {
      matches.push({
        teams,
        matchTime: $(el).find('.matchTime').text().trim(),
      });
    }
  });

  return matches;
}

module.exports = { getLiveMatches };