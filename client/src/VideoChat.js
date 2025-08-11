import React, { useEffect, useState, useRef } from 'react';
import Peer from 'simple-peer';
import styled from 'styled-components';

const Container = styled.div`
    padding: 20px;
    display: flex;
    height: 100%;
    width: 100%;
    margin: auto;
    flex-wrap: wrap;
    box-sizing: border-box;
`;

const StyledVideo = styled.video`
    height: 40%;
    width: 50%;
`;

const VideoChat = ({ socket }) => {
    const [yourID, setYourID] = useState("");
    const [users, setUsers] = useState([]);
    const [stream, setStream] = useState();
    const [receivingCall, setReceivingCall] = useState(false);
    const [caller, setCaller] = useState("");
    const [callerSignal, setCallerSignal] = useState();
    const [callAccepted, setCallAccepted] = useState(false);
    const [callEnded, setCallEnded] = useState(false);

    const userVideo = useRef();
    const partnerVideo = useRef();

    useEffect(() => {
        if (socket) {
            navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
                setStream(stream);
                if (userVideo.current) {
                    userVideo.current.srcObject = stream;
                }
            });

            socket.on("yourID", (id) => {
                setYourID(id);
            });
            socket.on("allUsers", (users) => {
                setUsers(Object.keys(users)); // Ensure we handle the users object correctly
            });

            socket.on("hey", (data) => {
                setReceivingCall(true);
                setCaller(data.from);
                setCallerSignal(data.signal);
            });
        }
    }, [socket]);

    function callPeer(id) {
        const peer = new Peer({
            initiator: true,
            trickle: false,
            stream: stream,
        });

        peer.on("signal", data => {
            socket.emit("callUser", { userToCall: id, signalData: data, from: yourID })
        });

        peer.on("stream", stream => {
            if (partnerVideo.current) {
                partnerVideo.current.srcObject = stream;
            }
        });

        socket.on("callAccepted", signal => {
            setCallAccepted(true);
            peer.signal(signal);
        });
    }

    function acceptCall() {
        setCallAccepted(true);
        const peer = new Peer({
            initiator: false,
            trickle: false,
            stream: stream,
        });
        peer.on("signal", data => {
            socket.emit("acceptCall", { signal: data, to: caller });
        });

        peer.on("stream", stream => {
            partnerVideo.current.srcObject = stream;
        });

        peer.signal(callerSignal);
    }

    let UserVideo;
    if (stream) {
        UserVideo = (
            <StyledVideo playsInline muted ref={userVideo} autoPlay />
        );
    }

    let PartnerVideo;
    if (callAccepted && !callEnded) {
        PartnerVideo = (
            <StyledVideo playsInline ref={partnerVideo} autoPlay />
        );
    }

    let incomingCall;
    if (receivingCall && !callAccepted) {
        incomingCall = (
            <div>
                <h1>{caller} is calling you</h1>
                <button onClick={acceptCall}>Accept</button>
            </div>
        );
    }

    return (
        <Container>
            {UserVideo}
            {PartnerVideo}
            <div>
                {users.filter(id => id !== yourID).map(id => (
                    <button key={id} onClick={() => callPeer(id)}>Call {id}</button>
                ))}
            </div>
            {incomingCall}
        </Container>
    );
};

export default VideoChat;
