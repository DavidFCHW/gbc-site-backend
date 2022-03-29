import { google } from 'googleapis';
import SpotifyWebApi from "spotify-web-api-node";
import dateFormat from 'dateformat';
import capitalizeTitle from 'capitalize-title';
import {createRequestParam, getDate, getSpeaker, getTimestampParam} from './utils.js'
import jsf from 'jsonfile';
import {createObjectCsvWriter} from "csv-writer";


//API keys and secrets
const client_id = 'process.env.CLIENT_ID';
const client_secret = 'process.env.CLIENT_SECRET';
const api_key = 'process.env.API_KEY';

//file paths of data output
const all_data_file = 'all-data.json';
const all_csv_file = 'all-data.csv';

const youtubeBaseURL = 'https://youtube.com/watch?v=';

export var data = {
  sermons: []
};

//IDs of public resources
const sermonPlaylistId = 'PLypLoRrvfFpPGiPdoDeeDA9Q9wzwTM5I8';
const livestreamPlaylistId = 'PLypLoRrvfFpPT3EdmDrUZ9IlVepySdMuz';
const gbcPodcastId = '1vaBG0PUEdA75ji6cr74d3';

//accessing the YouTube and Spotify APIs
const youtube = google.youtube({
  version: 'v3',
  auth: api_key
});

const spotify = new SpotifyWebApi ({
  clientId: client_id,
  clientSecret: client_secret
});


/**
 *
 * @param item
 */
function createSermonObject(item) {
  let titleArray = item.snippet.title.split(' - ');
  let title = capitalizeTitle(titleArray[0].trim());
  let scripture = capitalizeTitle(titleArray[1].trim());
  let description = item.snippet.description;
  description = description === undefined ? description : description.toLowerCase();
  let videoId = item.contentDetails.videoId;
  let desArray = description.split('\n');
  let date_dirty = getDate(desArray);
  date_dirty = date_dirty === null ? item.contentDetails.videoPublishedAt : date_dirty;
  let date = dateFormat(date_dirty, 'dd mmmm yyyy');
  // let date = dateFormat(date_dirty, 'mmmm dd, yyyy hh:mm pm');

  let sermon = {
    title: title,
    speaker: getSpeaker(description),
    scripture: scripture,
    date_dirty: date_dirty,
    date: date,
    youTubeUrl: youtubeBaseURL + videoId,
    id: videoId
  }
  console.log(sermon);
  data.sermons.push(sermon);
}

/**
 *
 * @param item
 */
function createLivestreamObject(item) {
  let description = item.snippet.description.toLowerCase();
  let lines = description.split('\n');

  let title = lines.find(line => line.startsWith('title')).substring('title:'.length);
  title = capitalizeTitle(title.trim());

  let scripture = lines.find(line => line.includes('scripture:')).substring('scripture:'.length);
  scripture = capitalizeTitle(scripture.trim());

  let videoId = item.contentDetails.videoId;
  let urlParams = videoId + getTimestampParam(lines);

  let titleArray = item.snippet.title.split(' - ');
  let date_dirty = getDate(titleArray);
  let date = dateFormat(getDate(titleArray), 'dd mmmm yyyy');
  // let date = dateFormat(getDate(titleArray), 'mmmm dd, yyyy hh:mm pm');
  let sermon = {
    title: title,
    speaker: getSpeaker(description),
    scripture: scripture,
    date_dirty: date_dirty,
    date: date,
    youTubeUrl: youtubeBaseURL + urlParams,
    id: videoId
  }

  data.sermons.push(sermon);
}

/**
 *
 * @param requestParam
 * @returns {Promise<void>}
 */
async function processData(requestParam) {
  let next = true;
  while (requestParam.pageToken || next) {
    await youtube.playlistItems.list(requestParam).then(res => {
      let items = res.data.items;
      // console.log(items[0]);
      // console.log(items[0].snippet);
      if (items[0].snippet.title.toLowerCase().includes('service')) {
        items.forEach(createLivestreamObject);
      } else {
        items.forEach(createSermonObject);
      }

      if (res.data.nextPageToken) {
        requestParam.pageToken = res.data.nextPageToken;
      } else {
        delete requestParam.pageToken;
        next = false;
      }
    }).catch(err => {
      console.log(err);
    });
  }
}

let sermonRequestParam = createRequestParam(sermonPlaylistId);
let livestreamRequestParam = createRequestParam(livestreamPlaylistId);


await processData(sermonRequestParam);
await processData(livestreamRequestParam);

data.sermons.sort((a, b) => {
  if (new Date(a.date_dirty).getTime() > new Date(b.date_dirty).getTime()) {
    return -1;
  } else if (new Date(a.date_dirty).getTime() < new Date(b.date_dirty).getTime()) {
    return 1;
  } else {
    return 0;
  }
});

for (let i = data.sermons.length, j = 0; i > 0; i--, j++) {
  data.sermons[j].sortId = i;
}

await spotify.clientCredentialsGrant().then(res => {
  spotify.setAccessToken(res.body.access_token);
  return spotify.getShow(gbcPodcastId, {market: 'ES'});
}).then(res => {
  let items = res.body.episodes.items;
  items.forEach(item => {
    let title = item.name.split('-', 1)[0].trim();
    let uri = item.uri;
    let link = item.external_urls.spotify;

    let index = data.sermons.findIndex(sermon => sermon.title.toLowerCase() === title.toLowerCase());
    if(index != -1) {
      // data.sermons[index].spotifyURI = uri;
      data.sermons[index].spotifyURL = link;
    }
  });
}).catch(err => {
  console.log(err);
});

//writing data object to a JSON file.
jsf.writeFileSync(all_data_file, data, {spaces: 2});
let csvHeader = [
  {id: 'title', title: 'Title'},
  {id: 'speaker', title: 'Speaker'},
  {id: 'scripture', title: 'Scripture'},
  {id: 'date_dirty', title: 'Date_Dirty'},
  {id: 'date', title: 'Date'},
  {id: 'youTubeUrl', title: 'YouTube URL'},
  {id: 'id', title: 'ID'},
  {id: 'sortId', title: 'Sort ID'},
  {id: 'spotifyURL', title: 'Spotify URL'}
];

await createObjectCsvWriter({
  path: all_csv_file,
  header: csvHeader
}).writeRecords(data.sermons);

// await csvWriter.writeRecords(data.sermons);

console.log(data.sermons.length);