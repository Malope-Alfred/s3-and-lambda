import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import axios from "axios"; // Importing axios

const DEFAULT_REGION = 'af-south-1';
const DEPLOY_REGION = process.env.REGION || DEFAULT_REGION;
const BUCKET_NAME = process.env.BUCKET_NAME || '';

if (!BUCKET_NAME) {
    throw new Error("Bucket name is not specified. Set the BUCKET_NAME environment variable.");
}

const awsConfig = {
    region: DEPLOY_REGION,
};

/**
 * Lambda handler function. Fetches user details and archives them to S3.
 */
export const lambdaHandler = async (): Promise<void> => {
    const s3Client = new S3Client(awsConfig);

    try {
        const userDetails = await getUserDetails();

        if (userDetails.length === 0) {
            console.log("No user details found to archive.");
            return;
        }
        await archiveDataToS3(userDetails, s3Client);

        console.log("User details successfully archived to S3.");
    } catch (error) {
        console.error("Error in lambdaHandler:", error);
        throw error;
    }
};

/**
 * Archives data to S3 as a JSON file.
 * @param data - The data to archive.
 * @param client - The S3 client instance.
 */
const archiveDataToS3 = async (data: object[], client: S3Client): Promise<void> => {
    const formattedDate = new Date().toISOString().split("T")[0];
    const fileName = `user-details-${formattedDate}.json`;
    const fileContents = JSON.stringify(data, null, 2); 

    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: fileContents,
    });

    try {
        console.log(`Uploading file to S3: ${fileName}`);
        await client.send(command);
    } catch (error) {
        console.error("Failed to upload file to S3:", error);
        throw new Error(`Could not upload to S3: ${error}`);
    }
};

/**
 * Fetches user details from the Random User API using axios.
 * @returns An array of user details.
 */
export const getUserDetails = async (): Promise<object[]> => {
    const API_URL = "https://randomuser.me/api/?results=10"; // Fetch 10 random users

    try {
        const response = await axios.get(API_URL);

        if (response.status !== 200) {
            throw new Error(`Failed to fetch user details: ${response.statusText}`);
        }

        return response.data.results.map((user: any) => ({
            id: user.login.uuid,
            name: `${user.name.first} ${user.name.last}`,
            email: user.email,
            country: user.location.country,
        }));

    } catch (error: any) {
        console.error("Error fetching user details:", error);
        throw new Error(`Could not fetch user details: ${error.message}`);
    }
};
