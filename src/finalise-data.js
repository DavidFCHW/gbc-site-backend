import {data} from "./process-sermons.js";
import jsf from 'jsonfile';
import {createObjectCsvWriter} from "csv-writer";

//file paths of data output
const all_data_file = 'data/all-sermons.json';
const all_csv_file = 'data/all-sermons.csv';

//sort the data object according to date.
data.sermons.sort((a, b) => {
    if (new Date(a.date_dirty).getTime() > new Date(b.date_dirty).getTime()) {
        return -1;
    } else if (new Date(a.date_dirty).getTime() < new Date(b.date_dirty).getTime()) {
        return 1;
    } else {
        return 0;
    }
});

//assign a sort id for each sermon for wix content manager.
for (let i = data.sermons.length, j = 0; i > 0; i--, j++) {
    data.sermons[j].sortId = i;
}

//writing data object to a JSON file.
jsf.writeFileSync(all_data_file, data, {spaces: 2});

//create csv headers based off json properties.
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

//writing data object to a csv file.
await createObjectCsvWriter({
    path: all_csv_file,
    header: csvHeader
}).writeRecords(data.sermons);


console.log("Total: " + data.sermons.length);