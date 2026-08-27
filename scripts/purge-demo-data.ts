import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function purgeDemoData() {
  console.log('Purging all demo / test / dummy data...');

  // Delete all activity events
  const deletedActivity = await prisma.activityEvent.deleteMany({});
  console.log(`Deleted ${deletedActivity.count} activity events.`);

  // Delete all clicks
  const deletedClicks = await prisma.click.deleteMany({});
  console.log(`Deleted ${deletedClicks.count} click records.`);

  // Delete all payments
  const deletedPayments = await prisma.payment.deleteMany({});
  console.log(`Deleted ${deletedPayments.count} payment records.`);

  // Delete all bids
  const deletedBids = await prisma.bid.deleteMany({});
  console.log(`Deleted ${deletedBids.count} bid records.`);

  // Delete all listings
  const deletedListings = await prisma.listing.deleteMany({});
  console.log(`Deleted ${deletedListings.count} listings.`);

  // Delete all test visitor sessions
  const deletedSessions = await prisma.visitorSession.deleteMany({ where: { sessionToken: { startsWith: 'test_' } } });
  console.log(`Deleted ${deletedSessions.count} test visitor sessions.`);

  // Delete all test listing visits
  const deletedListingVisits = await prisma.listingVisit.deleteMany({ where: { sessionToken: { startsWith: 'test_' } } });
  console.log(`Deleted ${deletedListingVisits.count} test listing visits.`);

  console.log('Database successfully cleaned! Ready for production.');
}

purgeDemoData()
  .catch((e) => {
    console.error('Error purging demo data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
