import express from 'express';
import mongoose from 'mongoose';
import axios from 'axios';
import cors from 'cors';
import bodyParser from 'body-parser';

const app = express();
app.use(cors());
app.use(bodyParser.json());

mongoose.connect('mongodb+srv://ojhaabhishekraj14:u6FJx3piQHL3Vcq6@cluster0.cuyaowl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    ssl: true,
});

const UserSchema = new mongoose.Schema({
    name: String,
    facebookId: String,
    accessToken: String,
});

const User = mongoose.model('User', UserSchema);

app.post('/api/login', async (req, res) => {
    const { accessToken, userID } = req.body;
    console.log('accessToken',accessToken)
    try {
        const response = await axios.get(`https://graph.facebook.com/me?access_token=${accessToken}`);
        const { name, id } = response.data;

        let user = await User.findOne({ facebookId: id });
        if (!user) {
            user = new User({ name, facebookId: id, accessToken });
            await user.save();
        } else {
            user.accessToken = accessToken;
            await user.save();
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Failed to login' });
    }
});

app.get('/api/pages', async (req, res) => {
    const { userID } = req.query;
    console.log('user',userID)
    try {
        const user = await User.findById(userID);
        const response = await axios.get(`https://graph.facebook.com/me/accounts?access_token=${user.accessToken}`);
        res.json(response.data.data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch pages' });
    }
});

app.get('/api/insights', async (req, res) => {
    const { pageID, userID, since, until } = req.query;
   console.log('ndna',since,until)
   try {
    const user = await User.findById(userID);

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    const pageResponse = await axios.get('https://graph.facebook.com/me/accounts', {
        params: {
            access_token: user.accessToken,
        },
    });

    const page = pageResponse.data.data.find(p => p.id === pageID);
    const pageAccessToken = page ? page.access_token : null;

    if (!pageAccessToken) {
        return res.status(400).json({ error: 'Page Access Token not found' });
    }
    // ,'post_reactions_by_type_total',''post_reactions_by_type_total'
    const metrics = ['page_follows', 'page_impressions', 'post_reactions_by_type_total', 'post_engaged_users'];

    // Function to fetch insights for a specific metric
    const fetchInsightsForMetric = async (metric) => {
      try {
        const response = await axios.get(`https://graph.facebook.com/${pageID}/insights`, {
          params: {
            metric,
            since,
            until,
            period: 'total_over_range',
            access_token: pageAccessToken,
          },
        });
        console.log('responseDatandskj',response.data.data)
        return response.data.data;
       
      } catch (error) {
        console.error(`Error fetching metric ${metric}:`, error);
        return null;
      }
    };

    // Fetch insights for all metrics
    const insightsData = {};
    for (const metric of metrics) {
      const data = await fetchInsightsForMetric(metric);
      if (data && data.length > 0) {
        // Extract values[0].value
        insightsData[metric] = data[0].values[0].value;
      }
    }

    console.log('insights', insightsData);
    res.json(insightsData);
}  catch (error) {
        console.log('error fetching insights',error)
        res.status(500).json({ error: 'Failed to fetch insights' });
    }
});

app.listen(5000, () => {
    console.log('Server is running on port 5000');
});
