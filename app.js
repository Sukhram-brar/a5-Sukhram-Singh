import express from 'express';
import db from './database/db.js';

const app = express();
app.use(express.static('public'));

app.use(express.urlencoded({ extended: false }));

app.get('/api/v1/authors',(req,res)=>{
    const statement=db.prepare('SELECT * FROM authors');
    const authors=statement.all();
    res.json(authors);
});

app.get('/api/v1/books',(req,res)=>{
    const format=req.query.format ?? 'hardcover';
    const pages=Number(req.query.pages ?? 0);

    if(!['hardcover','paperback'].includes(format)||
        !Number.isSafeInteger(pages) ||
        pages < 0 ||
        !Number.isSafeInteger(pages * 10)){
            res.status(400).json({error: 'Invalid pages or Format '});
        }
    
    const offset=pages*10;
    const statement=db.prepare(`
         SELECT id, isbn, title, format, year
        FROM books
        WHERE format = ?
        ORDER BY id
        LIMIT 10 OFFSET ?`);
    const books = statement.all(format, offset);

    res.json(books);
});

app.get('/api/v1/books/:isbn', (req,res)=>{
    const isbn=req.params.isbn;
    const statement=db.prepare(`SELECT * FROM books WHERE isbn=?`)
    const result=statement.get(isbn);

    if(!result)
        res.status(400).json({error:'Book not Found!!!'});

    const publisherStatement=db.prepare(`SELECT publisher FROM publishers WHERE id=?`);
    const publisherRecord = publisherStatement.get(result.publisher_id);
    result.publisher=publisherRecord? publisherRecord.publisher : null;

    const ratingstatement=db.prepare(`SELECT rating FROM ratings WHERE book_id=?`);
    const rating=ratingstatement.all(result.id);
    
    let totalRating=0;
    rating.forEach((i)=>{
        totalRating+=i.rating;
    });

    result.avg_rating=rating.length>0?totalRating/rating.length:null;

    res.json(result);
});

app.post('/api/v1/ratings' ,(req,res)=>{
    const id=Number(req.body.book_id);
    const rating=Number(req.body.rating);

    if (!Number.isSafeInteger(id) ||id < 1 ||!Number.isInteger(rating) ||rating < 0 ||rating > 5)
        return res.status(400).json({error:'Invalid book ID or rating'});

    const bookStatement = db.prepare(
        'SELECT id FROM books WHERE id = ?'
    );

    const book = bookStatement.get(id);
    if (!book) {
        return res.status(404).json({
            error: 'Book does not exist'
        });
    }

    const statement = db.prepare(
        'INSERT INTO ratings (book_id, rating) VALUES (?, ?)'
    );
    statement.run(id,rating);

    res.status(201).json({
        message: 'Rating added successfully'
    });
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
