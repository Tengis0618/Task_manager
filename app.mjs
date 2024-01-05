// app.mjs
import express from 'express';
import {resolve, dirname} from 'path';
import {readFile, readdir} from 'fs';
import {fileURLToPath} from 'url';
import * as path from 'path';
import {Task} from './task.mjs';

const app = express();
// set hbs engine
app.set('view engine', 'hbs');


// TODO: use middleware to serve static files from public
// make sure to calculate the absolute path to the directory
// with import.meta.url

// TODO: use middleware required for reading body
const __dirname = dirname(fileURLToPath(import.meta.url));
const publicPath = resolve(__dirname, "public");

app.use(express.static(publicPath));
// The global list to store all tasks to be rendered
let taskList = [];

// The reading path
const readingPath = path.resolve(__dirname, './saved-tasks');

/**
 * This function sort tasks by the give criteria "sort-by" and "sort-order"
 * @param {Request} req query should contain "sort-by" and "sort-order"
 * @param {[Task]} l the array of tasks to be sorted
 * @return {[Task]} sorted array of tasks by the given criteria
 */
function sortTasks(req, l) {
  if (req.query['sort-by'] && req.query['sort-order']) {
    const newL = [...l];
    const crit = req.query['sort-by'];
    const ord = req.query['sort-order'];
    newL.sort((a, b)=>{
      if (ord === 'asc') {
        switch (crit) {
          case 'due-date': {
            const a1 = new Date(a[crit]);
            const b1 = new Date(b[crit]);
            if (a1 === b1) { return 0; }
            return a1 > b1 ? 1 : -1;
          }
          case 'priority': {
            return a[crit] - b[crit];
          }
          default: {
            return 0;
          }
        }
      } else if (ord === 'desc') {
        switch (crit) {
          case 'due-date': {
            const a1 = new Date(a[crit]);
            const b1 = new Date(b[crit]);
            if (a1 === b1) { return 0; }
            return a1 < b1 ? 1 : -1;
          }
          case 'priority': {
            return b[crit] - a[crit];
          }
          default: {
            return 0;
          }
        }
      } else {
        return [];
      }
    });
    return newL;
  } else {
    return l;
  }
}

/**
 * This function sort tasks by whether they are pinned or not
 * @param {[Task]} l the array of tasks to be sorted
 * @return {[Task]} sorted array of tasks, with pinned tasks first
 */
function pinnedTasks(l) {
  return [...l].sort((a, b)=>b.pinned-a.pinned);
}

function readTasks(callback) {
  readdir(readingPath, (err, files) => {
    if (err) {
      return callback(err);
    }
    // Read each task file
    files.forEach((file) => {
      readFile(path.join(readingPath, file), 'utf8', (err, data) => {
        if (err) {
          console.error(`Error reading file ${file}: ${err.message}`);
          return;
        }
        try {
          const taskData = JSON.parse(data);
          const task = new Task(taskData);
          if (task.pinned){
            taskList.splice(0, 0, task);
          } else {
            taskList.push(task);
          }
        } catch (parseError) {
          console.error(`Error parsing JSON in file ${file}: ${parseError.message}`);
        }
      });
    });
    // Call the callback with the array of tasks
    callback(null, taskList);
  });
}


app.use(express.urlencoded({ extended: true }));

// Custom middleware for request logging
app.use((req, res, next) => {
  console.log('Method:', req.method);
  console.log('Path:', req.path);
  console.log('Query:', req.query);
  console.log('Body:', req.body);
  next(); // Continue processing the request
});

readTasks((err) => {
  if (err) {
    console.error(err);
    return;
  }
});

app.get('/', function(req, res){
    const hasQuery = Object.keys(req.query).length > 0;
    if (hasQuery){
      if ('sort-by' in req.query){
      taskList = sortTasks(req, taskList);
      } else {
        if (req.query.titleQ) {
          taskList = taskList.filter(task => task.title.includes(req.query.titleQ));
        }
        if (req.query.tagQ) {
          taskList = taskList.filter(task => task.tags.includes(req.query.tagQ));
        }
      }
      taskList = pinnedTasks(taskList);
    }
    res.render('home', {layout: 'layout', taskList});
  });

app.get('/add', function(req, res){
  res.render('add', {layout: 'layout'});
});

app.post('/add', function(req, res){
  const title = req.body.title;
  const description = req.body.description;
  const priority = parseInt(req.body.priority, 10);
  const dueDate = req.body['due-date'];
  const pinned = req.body.pinned === 'true';
  const tags = req.body.tags ? req.body.tags.split(', ').map(tag => tag.trim()) : [];
  const progress = req.body.progress;

  // Create a new task object
  const newTaskData = {
    title,
    description,
    priority,
    'due-date': dueDate,
    pinned,
    tags,
    progress,
  };
  const newTask = new Task(newTaskData);
  // Add the new task to the global array of tasks
  if (pinned) {
    // If the task is pinned, add it to the beginning of the array
    taskList.unshift(newTask);
  } else {
    // Otherwise, add it to the end of the array
    taskList.push(newTask);
  }
  // Redirect to the home/main page to display the updated list
  res.redirect('/');
});

app.listen(3000);
