import Footer from './Footer';

export default function FeedFooter({
  stocksBrewMedium: _stocksBrewMedium = 'feed_footer',
}: {
  stocksBrewMedium?: string;
}) {
  return <Footer stocksBrewMedium={_stocksBrewMedium} />;
}
