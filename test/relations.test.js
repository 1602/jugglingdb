var db, Book, Chapter, Author, Reader;

describe('relations', function() {
    before(function() {
        db = getSchema();
        Book = db.define('Book', {name: String});
        Chapter = db.define('Chapter', {name: String});
        Author = db.define('Author', {name: String});
        Reader = db.define('Reader', {name: String});
    });

    after(function() {
        db.disconnect();
    });

    describe('hasMany', function() {
        it('can be declared in different ways', function() {
            Book.hasMany(Chapter);
            Book.hasMany(Reader, {as: 'users'});
            Book.hasMany(Author, {foreignKey: 'projectId'});
            var b = new Book;
            b.chapters.should.be.an.instanceOf(Function);
            b.users.should.be.an.instanceOf(Function);
            b.authors.should.be.an.instanceOf(Function);
            Object.keys((new Chapter).toObject()).should.include('bookId');
            Object.keys((new Author).toObject()).should.include('projectId');
        });

        it('can be declared in short form', function() {
            Author.hasMany('readers');
            (new Author).readers.should.be.an.instanceOf(Function);
            Object.keys((new Reader).toObject()).should.include('authorId');
        });
    });

    describe('belongsTo', function() {
        it('can be declared in different ways');
        it('can be declared in short form');
    });

    describe('hasAndBelongsToMany', function() {
        it('can be declared');
    });
});
