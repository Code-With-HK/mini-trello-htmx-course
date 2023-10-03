import express from "express";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { engine } from "express-handlebars";
import { readFileSync } from "fs";
import handlebars from "handlebars";
import { v4 as uuid } from "uuid";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = join(__dirname, "db.json");

const PORT = 3001;
const app = express();

app.engine("handlebars", engine());
app.set("view engine", "handlebars");
app.set("views", [`${__dirname}/views`]);

app.use(express.urlencoded({ extended: false }));

app.use(express.static(`${__dirname}/public`));

const adapter = new JSONFile(file);
const defaultData = {
  lists: [],
};
const db = new Low(adapter, defaultData);

const header = handlebars.compile(
  readFileSync(`${__dirname}/views/partials/header.handlebars`, "utf-8")
);

const addNewList = handlebars.compile(
  readFileSync(`${__dirname}/views/partials/add-new-list.handlebars`, "utf-8")
);

const list = handlebars.compile(
  readFileSync(`${__dirname}/views/partials/list.handlebars`, "utf-8")
);

const addNewCard = handlebars.compile(
  readFileSync(`${__dirname}/views/partials/add-new-card.handlebars`, "utf-8")
);

const cardItem = handlebars.compile(
  readFileSync(`${__dirname}/views/partials/card-item.handlebars`, "utf-8")
);

app.get("/", async (req, res) => {
  await db.read();
  const { lists } = db.data;

  res.render("index", {
    partials: { header, addNewList, list, addNewCard, cardItem },
    lists,
  });
});

app.get("/new-list", (req, res) => {
  res.render("partials/new-list", { layout: false });
});

app.get("/add-new-list", (req, res) => {
  res.render("partials/add-new-list", { layout: false });
});

app.post("/lists", async (req, res) => {
  const { name } = req.body;
  const newList = { listId: uuid(), name, cards: [] };
  db.data.lists.push(newList);
  await db.write();

  res.render("partials/list-with-new-list-btn", {
    layout: false,
    partials: { addNewCard, list, addNewList },
    ...newList,
  });
});

app.delete("/lists/:listId", async (req, res) => {
  const { listId } = req.params;
  const idx = db.data.lists.findIndex((t) => t.listId === listId);
  db.data.lists.splice(idx, 1);
  await db.write();

  res.status(200).send("");
});

app.get("/lists/edit/:listId", async (req, res) => {
  const { listId } = req.params;
  const list = db.data.lists.find((t) => t.listId === listId);

  res.render("partials/edit-list", {
    layout: false,
    ...list,
  });
});

app.patch("/lists/:listId", async (req, res) => {
  const { listId } = req.params;
  const { name } = req.body;
  const list = db.data.lists.find((t) => t.listId === listId);
  list.name = name;
  await db.write();

  res.render("partials/list-header", {
    layout: false,
    ...list,
  });
});

app.get("/lists/:listId/new-card", (req, res) => {
  const { listId } = req.params;
  res.render("partials/new-card-form", {
    layout: false,
    listId,
  });
});

app.get("/lists/:listId/add-new-card", (req, res) => {
  const { listId } = req.params;
  res.render("partials/add-new-card", { layout: false, listId });
});

app.post("/lists/:listId/cards", async (req, res) => {
  const { listId } = req.params;
  const { name } = req.body;
  const list = db.data.lists.find((t) => t.listId === listId);
  const newCard = { name, cardId: uuid(), listId };
  list.cards.push(newCard);
  await db.write();

  res.render("partials/card-item-with-add-card", {
    layout: false,
    partials: { addNewCard, cardItem },
    ...newCard,
  });
});

app.get("/lists/:listId/cards/:cardId", (req, res) => {
  const { listId, cardId } = req.params;
  const list = db.data.lists.find((t) => t.listId === listId);
  const card = list.cards.find((card) => card.cardId === cardId);

  return res.render("partials/edit-card", {
    layout: false,
    ...card,
  });
});

app.patch("/lists/:listId/cards/:cardId", async (req, res) => {
  const { listId, cardId } = req.params;
  const { name } = req.body;
  const list = db.data.lists.find((t) => t.listId === listId);
  const card = list.cards.find((card) => card.cardId === cardId);
  card.name = name;
  await db.write();

  return res.render("partials/card-item", {
    layout: false,
    ...card,
  });
});

app.delete("/lists/:listId/cards/:cardId", async (req, res) => {
  const { listId, cardId } = req.params;
  const list = db.data.lists.find((t) => t.listId === listId);
  const cardIdx = list.cards.findIndex((card) => card.cardId === cardId);
  list.cards.splice(cardIdx, 1);
  await db.write();

  res.status(200).send("");
});

app.post("/cards/move", async (req, res) => {
  const { fromList, toList, fromPosition, toPosition } = req.body;
  const parsedFromList = fromList.replace("sort-list-", "");
  const parsedToList = toList.replace("sort-list-", "");

  let filteredList = db.data.lists.find(
    (list) => list.listId === parsedFromList
  );
  const card = filteredList.cards.splice(fromPosition, 1)[0];

  if (parsedFromList !== parsedToList) {
    filteredList = db.data.lists.find((list) => list.listId === parsedToList);
  }
  filteredList.cards.splice(toPosition, 0, card);

  await db.write();

  res.send("");
});

app.post("/lists/move", async (req, res) => {
  const { fromPosition, toPosition } = req.body;
  const fromList = db.data.lists.splice(fromPosition, 1)[0];
  db.data.lists.splice(toPosition, 0, fromList);
  await db.write();

  res.send("");
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
