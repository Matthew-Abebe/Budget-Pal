require('dotenv/config');
const express = require('express');
const pg = require('pg');
const errorMiddleware = require('./error-middleware');
const staticMiddleware = require('./static-middleware');

const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const app = express();

app.use(staticMiddleware);

app.use(errorMiddleware);

const jsonMiddleware = express.json();

app.use(jsonMiddleware);

app.get('/api/categories', (req, res) => {
  const sql = `
    select "categoryId", "categoryName", "categoryAmount", sum("amount") as "totalSpent"
      from "categories"
      left join "purchases" using ("categoryId")
      group by "categoryId", "categoryName", "categoryAmount"
     order by "categoryId" desc
  `;
  db.query(sql)
    .then(result => {
      res.json(result.rows);
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({
        error: 'an unexpected error occurred'
      });
    });
});

app.get('/api/purchases', (req, res) => {
  const sql = `
    select "purchaseId", "categoryId", "description", "amount", "date", "categoryName" as "category"
      from "purchases"
      join "categories" using ("categoryId")
     order by "purchaseId" desc
  `;
  db.query(sql)
    .then(result => {
      res.json(result.rows);
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({
        error: 'an unexpected error occurred'
      });
    });
});

app.get('/api/purchases/countPurchases', (req, res) => {
  const sql = `
    select count("purchaseId"), "date"
      from "purchases"
     group by "date"
     order by "date" desc
  `;
  db.query(sql)
    .then(result => {
      res.json(result.rows);
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({
        error: 'an unexpected error occurred'
      });
    });
});

app.get('/api/purchases/amount', (req, res) => {
  const sql = `
    select "date", sum("amount") as amount
      from "purchases"
     group by "date"
     order by "date" desc
  `;
  db.query(sql)
    .then(result => {
      res.json(result.rows);
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({
        error: 'an unexpected error occurred'
      });
    });
});

app.get('/api/purchases/categorySpending', (req, res) => {
  const sql = `
    select "categoryId", sum("amount") as amount, "categoryName"
      from "purchases"
    join "categories" using("categoryId")
     group by "categoryId", "categoryName"
     order by "categoryName" desc
  `;
  db.query(sql)
    .then(result => {
      res.json(result.rows);
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({
        error: 'an unexpected error occurred'
      });
    });
});

app.get('/api/categories/categoryBudget', (req, res) => {
  const sql = `
    select sum("categoryAmount") as categoryAmount, "categoryName"
      from "categories"
     group by "categoryName"
     order by "categoryName" desc
  `;

  const secondSql = `
    select sum("amount") as "totalSpent", "categoryName" as "x"
      from "purchases"
      join "categories" using ("categoryId")
     group by "categoryName"
     order by "categoryName" desc
  `;

  Promise.all([
    db.query(sql),
    db.query(secondSql)
  ]).then(results => {
    res.status(200).json(results);
  })
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: 'an unexpected error occurred' });
    });
});

app.get('/api/purchases/countPurchasesByCategory', (req, res) => {
  const sql = `
    select count("purchaseId") as purchases, "categoryName"
      from "purchases"
    join "categories" using ("categoryId")
     group by "categoryName"
     order by "categoryName" desc
  `;
  db.query(sql)
    .then(result => {
      res.json(result.rows);
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({
        error: 'an unexpected error occurred'
      });
    });
});

app.get('/api/notes', (req, res) => {
  const sql = `
    select *
      from "notes"
     order by "noteId" desc
  `;
  db.query(sql)
    .then(result => {
      res.json(result.rows);
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({
        error: 'an unexpected error occurred'
      });
    });
});

app.post('/api/purchases', (req, res) => {

  const { categoryId, description, amount } = req.body;
  if (!categoryId || !description || !amount) {
    res.status(400).json({
      error: 'Please enter required fields'
    });
    return;
  }
  const sql = `
    insert into "purchases" ("categoryId", "description", "amount")
    values ($1, $2, $3)
    returning *
  `;

  const params = [categoryId, description, amount];

  db.query(sql, params)
    .then(results => {
      const secondParam = results.rows[0].purchaseId;
      const secondSql = `
    select "purchaseId", "categoryId", "description", "amount", "date", "categoryName" as "category"
      from "purchases"
      join "categories" using ("categoryId")
      where "purchaseId" = ${secondParam}
     order by "purchaseId" desc
  `;
      db.query(secondSql)
        .then(results => {
          res.status(201).json(results.rows[0]);
        });
    });

});

app.post('/api/categories', (req, res) => {
  const { categoryName, categoryAmount } = req.body;
  if (!categoryName || !categoryAmount) {
    res.status(400).json({
      error: 'Please enter required fields'
    });
    return;
  }
  const sql = `
    insert into "categories" ("categoryName", "categoryAmount")
    values ($1, $2)
    returning *
  `;

  const params = [categoryName, categoryAmount];

  db.query(sql, params)
    .then(results => {
      const secondParam = results.rows[0].categoryId;
      const secondSql = `
    select "categoryId", "categoryName", "categoryAmount", sum("amount") as "totalSpent"
      from "categories"
      left join "purchases" using ("categoryId")
      where "categoryId" = ${secondParam}
      group by "categoryId"
  `;
      db.query(secondSql)
        .then(results => {
          res.status(201).json(results.rows[0]);
        });
    });
});

app.post('/api/notes', (req, res) => {

  const { categoryId, category, note } = req.body;
  if (!categoryId || !category || !note) {
    res.status(400).json({
      error: 'Please enter required fields'
    });
    return;
  }
  const sql = `
    insert into "notes" ("categoryId", "category", "note")
    values ($1, $2, $3)
    returning *
  `;
  const params = [categoryId, category, note];
  db.query(sql, params)
    .then(result => {
      const [note] = result.rows;
      res.status(201).json(note);
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({
        error: 'an unexpected error occurred'
      });
    });
});

app.put('/api/categories', (req, res) => {

  const { categoryId, categoryName, categoryAmount } = req.body;

  if (!categoryId || !categoryName || !categoryAmount) {
    res.status(400).json({
      error: 'Please enter required fields'
    });
    return;
  }
  const sql = `
    update "categories"
    set    "categoryName"   = $1,
           "categoryAmount" = $2
    where  "categoryId"     = $3
    returning *
  `;
  const params = [categoryName, categoryAmount, categoryId];
  db.query(sql, params)
    .then(result => {
      const [category] = result.rows;
      res.status(201).json(category);
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({
        error: 'an unexpected error occurred'
      });
    });
});

app.put('/api/purchases', (req, res, next) => {

  const { purchaseId, categoryId, description, amount } = req.body;

  if (!purchaseId || !categoryId || !description || !amount) {
    res.status(400).json({
      error: 'Please enter required fields'
    });
    return;
  }
  const sql = `
    update "purchases"
    set    "categoryId"   = $1,
           "description" = $2,
           "amount" = $3
    where  "purchaseId"     = $4
    returning *
  `;
  const params = [categoryId, description, amount, purchaseId];

  db.query(sql, params)
    .then(results => {
      const secondParam = results.rows[0].purchaseId;
      const secondSql = `
    select "purchaseId", "categoryId", "description", "amount", "date", "categoryName" as "category"
      from "purchases"
      join "categories" using ("categoryId")
      where "purchaseId" = ${secondParam}
     order by "purchaseId" desc
  `;
      db.query(secondSql)
        .then(results => {
          const updatedPurchase = [results.rows[0]][0];
          console.log(updatedPurchase);
          if (!updatedPurchase) {
            res.status(404).json({
              error: `cannot find purchase with purchaseId ${secondParam}`
            });
          } else {
            console.log(updatedPurchase);
            res.json(updatedPurchase);
          }
        })
        .catch(err => next(err));
    });
});

app.put('/api/notes', (req, res) => {

  const { noteId, category, note } = req.body;

  if (!noteId || !category || !note) {
    res.status(400).json({
      error: 'Please enter required fields'
    });
    return;
  }
  const sql = `
    update "notes"
    set    "category"   = $1,
           "note" = $2
    where  "noteId"     = $3
    returning *
  `;
  const params = [category, note, noteId];
  db.query(sql, params)
    .then(result => {
      const [note] = result.rows;
      res.status(201).json(note);
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({
        error: 'an unexpected error occurred'
      });
    });
});

app.delete('/api/categories/:categoryId', function (req, res, next) {
  const categoryId = parseInt(req.params.categoryId);
  const sql = `
    delete from "categories"
    where "categoryId" = $1
    returning *
  `;
  const secondSql = `
    delete from "purchases"
    where "categoryId" = $1
    returning *
  `;
  const thirdSql = `
    delete from "notes"
    where "categoryId" = $1
    returning *
  `;
  const params = [categoryId];

  Promise.all([
    db.query(sql, params),
    db.query(secondSql, params),
    db.query(thirdSql, params)
  ]).then(result => {
    res.sendStatus(204);
  })
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: 'an unexpected error occurred' });
    });
});

app.delete('/api/purchases/:purchaseId', function (req, res, next) {
  const purchaseId = parseInt(req.params.purchaseId);

  const sql = `
    delete from "purchases"
    where "purchaseId" = $1
    returning *
  `;

  const params = [purchaseId];

  db.query(sql, params)
    .then(result => {
      const data = result.rows[0];
      res.status(204).json(data);
    })
    .catch(err => {
      next(err);
    });
});

app.delete('/api/notes/:noteId', function (req, res, next) {
  const noteId = parseInt(req.params.noteId);

  const sql = `
    delete from "notes"
    where "noteId" = $1
    returning *
  `;

  const params = [noteId];

  db.query(sql, params)
    .then(result => {
      const data = result.rows[0];
      res.status(204).json(data);
    })
    .catch(err => {
      next(err);
    });
});

app.listen(process.env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`express server listening on ${process.env.PORT}`);
});
