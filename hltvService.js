const { Hltv } = require('./hltv');

async function scrapeFuriaData() {
  const furiaId = 8297;

  const teamData = await new Hltv().getTeam({ id: furiaId });

  const lineup = teamData.players.map(p => p.name);

  const titles = teamData.achievements?.map(t => t.place + ' - ' + t.event) || [];

  const mapStats = teamData.mapStats.map(s => ({
    map: s.map,
    winrate: s.winRate + '%'
  }));

  const recentMatches = teamData.recentMatches?.map(m => ({
    opponent: m.opponent,
    result: m.score,
    event: m.event,
    date: new Date(m.date)
  })) || [];

  const upcomingMatches = teamData.upcomingMatches?.map(m => ({
    opponent: m.opponent,
    event: m.event,
    date: new Date(m.date).toISOString()
  })) || [];

  let liveMatch = null;
  const now = Date.now();
  for (const match of teamData.upcomingMatches || []) {
    if (Math.abs(new Date(match.date).getTime() - now) < 60 * 60 * 1000) {
      liveMatch = {
        opponent: match.opponent.name,
        event: match.event.name,
        time: new Date(match.date).toISOString()
      };
      break;
    }
  }

  const doc = {
    lineup,
    mapStats,
    recentMatches,
    upcomingMatches,
    liveMatch
  };

  return doc;
}

module.exports = { scrapeFuriaData };