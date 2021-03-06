const mongoose = require('mongoose');
const Listing = mongoose.model('Listing');
const User = mongoose.model('User');
const multer = require('multer');
const jimp = require('jimp');
const uuid = require('uuid');

const multerOptions = {
  storage: multer.memoryStorage(),
  fileFilter(req, file, next){
    const isPhoto = file.mimetype.startsWith('image/');
    if(isPhoto){
      next(null, true);
    }else{
      next({message: 'That filetype isn\'t allowed'}, false);
    }
  }
};

// exports.homePage = (req, res) => {
//   res.render('index', {title: 'Hello World'});
// };

exports.addListing = (req, res) => {
  res.render('editListing', {title: 'Add Listing'});
};

exports.upload = multer(multerOptions).single('pic');
exports.resize = async (req, res, next) => {
  if(!req.file){
    next();
    return;
  }
  const extension = req.file.mimetype.split('/')[1];
  req.body.pic = `${uuid.v4()}.${extension}`;
  const pic = await jimp.read(req.file.buffer);
  await pic.resize(800, jimp.AUTO);
  await pic.write(`./public/uploads/${req.body.pic}`);
  next();
};

exports.createListing = async (req, res) => {
  req.body.author = req.user._id;
  const listing = await (new Listing(req.body)).save();
  req.flash('success', `Successfully Created ${listing.title}`);
  res.redirect(`/listing/${listing.slug}`);
};

exports.getListings  = async (req, res) => {
  const page = req.params.page || 1;
  const limit = 4;
  const skip = (page * limit) - limit;
  const listingsPromise = Listing
    .find()
    .skip(skip)
    .limit(limit)
    .sort({ created: 'desc'});

  const countPromise = Listing.count();
  const [listings, count] = await Promise.all([listingsPromise, countPromise]);
  const pages = Math.ceil(count/limit);
  if(!listings.length && skip){
    req.flash('info', `Hey, the page ${page} you asked for doen't exist. So I redirect you to page ${pages}`);
    res.redirect(`/listings/page/${pages}`);
    return;
  }
  res.render('listings', {title: "Listings", listings, page, pages, count });
};

exports.homePage  = async (req, res) => {
  const page = req.params.page || 1;
  const limit = 4;
  const skip = (page * limit) - limit;
  const listingsPromise = Listing
    .find()
    .skip(skip)
    .limit(limit)
    .sort({ created: 'desc'});

  const countPromise = Listing.count();
  const [listings, count] = await Promise.all([listingsPromise, countPromise]);
  const pages = Math.ceil(count/limit);
  if(!listings.length && skip){
    req.flash('info', `Hey, the page ${page} you asked for doen't exist. So I redirect you to page ${pages}`);
    res.redirect(`/listings/page/${pages}`);
    return;
  }
  res.render('index', {title: "Listings", listings, page, pages, count });
};


const confirmListingOwner = (listing, user) => {
  if(!listing.author.equals(user._id)){
    throw Error('Access Denied! You must be the owner to edit');
  };
};

exports.editListing  = async (req, res) => {
  const listing = await Listing.findOne({ _id: req.params.id });
  confirmListingOwner(listing, req.user);
  res.render('editListing', {title: `Edit ${listing.title}`, listing });
};

exports.updateListing = async (req, res) => {
  // set the location data to be a Point
  req.body.location.type = 'Point';
  // Find and update listing
  const listing = await Listing.findOneAndUpdate({ _id: req.params.id }, req.body, {
    new: true,
    runValidators: true
  }).exec();
  req.flash('success', `Successfully updated <strong>${listing.title}</strong>. <a href="/listing/${listing.slug}">View Listing -></a>`)
  // res.redirect(`/listings/${listing._id}/edit`);
  res.redirect(`/listing/${listing.slug}`);
};

exports.getListingBySlug = async (req, res, next ) => {
  const listing = await Listing.findOne({slug: req.params.slug}).populate('author reviews');
  if(!listing) return next();
  res.render('listing', { listing, title: listing.title});
};

exports.getListingsByTypes = async (req, res) => {
  const type = req.params.listingTypes;
  const listingTypesQuery = type || { $exists: true };
  const listingTypesPromise = Listing.getListingTypesList();
  const listingsPromise = Listing.find({ listingTypes: listingTypesQuery });
  const [listingTypes, listings] = await Promise.all([listingTypesPromise, listingsPromise])

  res.render('home', {listingTypes, title: 'For Sale / For Rent', type, listings });
};

exports.getListingsByStates = async (req, res) => {
  const state = req.params.states;
  const statesQuery = state || { $exists: true };
  const statesPromise = Listing.getListingStatesList();
  const listingsPromise = Listing.find({ states: statesQuery });
  const [states, listings] = await Promise.all([statesPromise, listingsPromise])

  res.render('states', {states, title: 'States', state, listings });
};

exports.searchListings = async (req, res) => {
  const listings = await Listing
    .find({ $text: { $search: req.query.q }},{score: { $meta: 'textScore' }})
    .sort({ score: { $meta: 'textScore' }})
    .limit(6);
    res.json(listings);
};

exports.listingsMap = async (req,res) => {
  const coordinates = [req.query.lng, req.query.lat].map(parseFloat);
  const q = {
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates
        },
        $maxDistance: 100000 // 10Km
      }
    }
  }
  const listings = await Listing.find(q).select('slug title description pic location').limit(20);
  res.json(listings);
};

exports.listingsMapPage = (req, res) => {
  res.render('map', {title: 'Map'});
};

exports.favoriteListing = async (req, res) => {
  const favorites = req.user.favorites.map(obj => obj.toString());
  const operator = favorites.includes(req.params.id) ? '$pull' : '$addToSet';
  const user = await User.findByIdAndUpdate(req.user._id,
    { [operator]: {favorites: req.params.id }},
    {new: true}
  );
  res.json(user);
};

exports.getfavorites = async (req, res) => {
  const listings = await Listing.find({
    _id: { $in: req.user.favorites }
  });
  res.render('listings', { title: "Favorites", listings})
};

exports.getTopListings = async (req, res) => {
  const listings = await Listing.getTopListings();
  res.render('topListings', { listings, title: '⭐ Top Listings'});
};
