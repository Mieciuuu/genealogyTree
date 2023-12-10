const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const neo4j = require('neo4j-driver');

const app = express();
const port = 8080;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '.')));

const uri = 'neo4j+s://753c1643.databases.neo4j.io';
const user = 'neo4j';
const password = 'qPXtgRlbBHl_s7eFQARJahpJtQTNeW2jWbsqBPoVO6c';
const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

app.get('/get-people', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run('MATCH (person:Person) RETURN ID(person) as id, person.name as name, person.surname as surname');
    const people = result.records.map(record => {
      return {
        id: record.get('id'),
        name: record.get('name'),
        surname: record.get('surname')
      };
    });
    res.json(people);
  } catch (error) {
    console.error('Error retrieving data from Neo4j:', error);
    throw error;
  } finally {
    session.close();
  }
});

app.post('/submit/addition', (req, res) => {
  const { name, surname, checkbox_0, radioGroup_1, radioGroup_2 } = req.body;
  const session = driver.session();

  const resultPromise = session.writeTransaction(tx => {
    tx.run('CREATE (person:Person {name: "' + name + '", surname: "' + surname + '"})');
    if (checkbox_0 != undefined) {
      if (Array.isArray(checkbox_0)){
        for (i = 0; i < checkbox_0.length; ++i) {
          const children = checkbox_0[i].split(',');
          tx.run('MATCH (person:Person {name: "' + name + '", surname: "' + surname + '"}), (c:Person {name: "' + children[0] + '", surname: "' + children[1] + '"}) CREATE (c)-[:is_child_of]->(person)');
        }
      }
      else {
        const children = checkbox_0.split(',');
        tx.run('MATCH (person:Person {name: "' + name + '", surname: "' + surname + '"}), (c:Person {name: "' + children[0] + '", surname: "' + children[1] + '"}) CREATE (c)-[:is_child_of]->(person)');
      }
    }
    if (radioGroup_1 != undefined) {
      const father = radioGroup_1.split(',');
        tx.run('MATCH (person:Person {name: "' + name + '", surname: "' + surname + '"}), (c:Person {name: "' + father[0] + '", surname: "' + father[1] + '"}) CREATE (person)-[:is_child_of]->(c)');
    }
    if (radioGroup_2 != undefined) {
      const mother = radioGroup_2.split(',');
        tx.run('MATCH (person:Person {name: "' + name + '", surname: "' + surname + '"}), (c:Person {name: "' + mother[0] + '", surname: "' + mother[1] + '"}) CREATE (person)-[:is_child_of]->(c)');
    }
  });

  resultPromise
    .then(result => {
      console.log('Node and relationships created successfully');
      res.redirect('back');
    })
    .catch(error => {
      console.error('Error creating node and relationships:', error);
      res.status(500).send('Error creating node and relationships');
    });
});

app.delete('/delete-person/:name/:surname', async (req, res) => {
  const { name, surname } = req.params;

  const session = driver.session();
  try {
    await session.run('MATCH (person:Person {name: $name, surname: $surname}) DETACH DELETE person', { name, surname });
    console.log(`Person ${name} ${surname} deleted successfully`);
    res.status(200).send('Person deleted successfully');
  } catch (error) {
    console.error('Error deleting person:', error);
    res.status(500).send('Internal Server Error');
  } finally {
    session.close();
  }
});

app.get('/search-path/:start/:end', async (req, res) => {
  const { start, end } = req.params;
  startData = start.split(',');
  endData = end.split(',');
  if (start == end) {
    res.send(JSON.stringify('Seriously?'));
    return;
  }

  const session = driver.session();
  r = '';
  try {
    q = 'MATCH path = shortestPath((start:Person {name: "' + startData[0] + '", surname: "' + startData[1] + '"})\
    -[:is_child_of*]-\
    (end:Person {name: "' + endData[0] + '", surname: "' + endData[1] + '"})) RETURN path';
    const result = await session.run(q);
    const mappedResult = result.records.map(record => {
      return {
        start: record.get('path').start,
        end: record.get('path').end,
        segm: record.get('path').segments
      };
    });
    mappedResult[0].segm.forEach(seg => {
      r += seg.start.properties.name + ' ' + seg.start.properties.surname + ' jest ';
      if (seg.relationship.start.low == seg.start.identity.low) {
        r += 'dzieckiem ';
      } else {
        r += 'rodzicem ';
      }
      r += seg.end.properties.name + ' ' + seg.end.properties.surname + '. ';
    });
    console.log('Search successfull');
    res.send(JSON.stringify(r));
  } catch (error) {
    console.error('Error retrieving shortestPath from Neo4j:', error);
    throw error;
  } finally {
    session.close();
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
