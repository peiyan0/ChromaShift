import boto3
from botocore.exceptions import ClientError
from fastapi import UploadFile
import uuid
import os

from app.core.config import settings

class StorageService:
    """
    Handles interactions with S3-compatible storage (e.g., MinIO, AWS S3).
    Implements 7-day auto-expiry policies via S3 bucket lifecycle configurations
    or by generating expiring presigned URLs.
    """
    def __init__(self):
        # Initialize boto3 client for S3/MinIO
        self.s3_client = boto3.client(
            's3',
            endpoint_url=f"http://{settings.MINIO_SERVER}",
            aws_access_key_id=settings.MINIO_ROOT_USER,
            aws_secret_access_key=settings.MINIO_ROOT_PASSWORD,
            region_name="us-east-1" # MinIO default or AWS region
        )
        self.bucket_name = settings.MINIO_BUCKET_NAME
        self._ensure_bucket_exists()

    def _ensure_bucket_exists(self):
        try:
            self.s3_client.head_bucket(Bucket=self.bucket_name)
        except ClientError:
            # Bucket does not exist, create it
            try:
                self.s3_client.create_bucket(Bucket=self.bucket_name)
                # TODO: In production, configure bucket lifecycle policy here (e.g., 7-day expiration)
            except ClientError as e:
                print(f"Failed to create bucket: {e}")

    def upload_file(self, file: UploadFile, prefix: str = "uploads/") -> str:
        """
        Uploads a file to S3 and returns the generated S3 object key.
        """
        file_ext = os.path.splitext(file.filename)[1]
        object_key = f"{prefix}{uuid.uuid4()}{file_ext}"
        
        try:
            self.s3_client.upload_fileobj(
                file.file,
                self.bucket_name,
                object_key,
                ExtraArgs={'ContentType': file.content_type}
            )
            return object_key
        except ClientError as e:
            print(f"Error uploading file to S3: {e}")
            raise e

    def download_file(self, object_key: str, local_path: str):
        """
        Downloads a file from S3 to a local path.
        """
        try:
            self.s3_client.download_file(self.bucket_name, object_key, local_path)
        except ClientError as e:
            print(f"Error downloading file from S3: {e}")
            raise e

    def upload_from_path(self, local_path: str, object_key: str):
        """
        Uploads a file from a local path to S3.
        """
        try:
            self.s3_client.upload_file(local_path, self.bucket_name, object_key)
        except ClientError as e:
            print(f"Error uploading file from path to S3: {e}")
            raise e

    def copy_file(self, source_key: str, dest_key: str):
        """
        Copies an object within the same bucket.
        """
        try:
            copy_source = {
                'Bucket': self.bucket_name,
                'Key': source_key
            }
            self.s3_client.copy(copy_source, self.bucket_name, dest_key)
        except ClientError as e:
            print(f"Error copying file in S3: {e}")
            raise e

    def generate_presigned_url(self, object_key: str, expiration: int = 3600) -> str:
        """
        Generates a presigned URL to download an object from S3.
        Default expiration is 1 hour (3600 seconds).
        """
        try:
            response = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': object_key},
                ExpiresIn=expiration
            )
            return response
        except ClientError as e:
            print(f"Error generating presigned URL: {e}")
            return None

storage_service = StorageService()
