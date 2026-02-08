import React, { useState, useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';

import BookFeed from './screens/BookFeed';
import IdeaReel from './screens/IdeaReel';
import { getAllBooks } from './data';

export default function App() {
  const [selectedBook, setSelectedBook] = useState(null);
  const books = useMemo(() => getAllBooks(), []);

  return (
    <>
      <StatusBar style="light" />
      {selectedBook ? (
        <IdeaReel
          book={selectedBook}
          onBack={() => setSelectedBook(null)}
        />
      ) : (
        <BookFeed
          books={books}
          onSelectBook={setSelectedBook}
        />
      )}
    </>
  );
}
