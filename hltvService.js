const { Hltv } = require('./hltv');

async function scrapeFuriaData() {
  const furiaId = 8297;

  const teamData = await new Hltv().getTeam({ id: furiaId });

  const lineup = teamData.players.map(p => p.name);

  const mapStats = teamData.mapStats.map(s => ({
    map: s.map,
    winrate: s.winRate
  }));

  const recentMatches = teamData.recentMatches ? teamData.recentMatches : [];

  const upcomingMatches = teamData.upcomingMatches ? teamData.upcomingMatches : [];

  let liveMatch = null;
  const nextMatch = upcomingMatches[0].matches[0]

  const nextMatchData = await new Hltv().getMatch({ id: nextMatch.match_id });

  if (!nextMatch.iso_date){
    upcomingMatches[0].matches[0].iso_date = new Date(nextMatchData.date)
  }

  if (Math.abs(nextMatchData.status === 'Live')) {
    liveMatch = {
      opponent: nextMatch.opponent,
      event: upcomingMatches[0].event,
      time: new Date(nextMatchData.date),
      match_id : nextMatch.match_id
    };
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