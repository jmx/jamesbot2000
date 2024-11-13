const { WebClient } = require('@slack/web-api');
const fs = require('fs');
const sheets = require('./sheets');


function setDuty(config, team, duty) {
    const targetString = `:information_source: <@${duty[0].slackId}> &amp; <@${duty[1].slackId}> are on duty this week`;
    const web = new WebClient(config.oauth_token);
    web.conversations.info({
        channel: team.channelId
    }).then((res) => {
        
        if (res.channel.topic.value === targetString) {
            console.log('Topic already set');
            return;
        }

        web.conversations.setTopic({
            channel: team.channelId,
            topic: targetString
        }).then((res) => {
            console.log('Topic set: ', res);
        }).catch((err) => {
            console.error('Error setting topic: ', err);
        })
    }).catch((err) => {
        console.error('Error getting channel info: ', err);
    });
}

// read config
fs.readFile('config.json', 'utf8', async (err, data) => {
    if (err) {
        console.error(err);
        return;
    }
    const config = JSON.parse(data);
    sheets.config(config.google.sheet_id);
    // read the teams from the google sheet
    let auth = await sheets.authorize();

    let teams = await sheets.getTeams(auth);
    let members = await sheets.getMembers(auth);
    let roster = await sheets.getRoster(auth);
    const now = new Date();
    teams.forEach((team) => {
        console.log("Finding duty for", team.name);
        let teamDuty = roster.reduce((duty, row) => {
            // cast row.date to a date object
            let dateParts = row.date.split('.');
            let date = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T00:00:00+00:00`);
            
            return (date > now || team.name !== row.team) ? duty : [row.duty, row.shadow];
        }, []);
        // get the slack IDs for the team member
        teamDuty = teamDuty.reduce((duties, name) => {
            duties.push(members.filter( member => name === member.name )[0]);
            return duties;
        }, []);

        setDuty(config.slack, team, teamDuty);
    });
});